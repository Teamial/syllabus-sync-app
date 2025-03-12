import React, { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import FileUploader from "./FileUploader";
import AssignmentTable from "./AssignmentTable";
import ExportOptions from "./ExportOptions";
import {
  parseDate,
  formatDate,
  isDateInPast,
  extractYearFromSheetName,
} from "./DateUtils";
import { parseTimelineSheet, detectTimelineFormat } from "./TimelineParser";
import HelpSection from "./HelpSection";
import { parseCMP168Timeline } from './CMP168Parser';

// Ultra-reliable function to detect workbook objects
function isWorkbookObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }

  // Check for specific workbook properties
  const workbookProperties = [
    "Directory",
    "Workbook",
    "Props",
    "Custprops",
    "Deps",
    "Sheets",
    "SheetNames",
    "Strings",
    "Styles",
    "Themes",
    "SSF",
  ];

  // If it has ANY of these properties, consider it a workbook
  for (const prop of workbookProperties) {
    if (prop in obj) {
      return true;
    }
  }

  return false;
}

// Ultra-reliable sanitizer function that creates brand new clean objects
function sanitizeAssignmentData(assignments) {
  if (!Array.isArray(assignments)) {
    console.warn("sanitizeAssignmentData received non-array:", assignments);
    return [];
  }

  console.log(`Sanitizing ${assignments.length} assignments`);

  // First, filter out anything that's not an object or is a workbook
  const filteredAssignments = assignments.filter((item) => {
    // Basic type checking
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      console.warn("Filtered out invalid item type:", typeof item);
      return false;
    }

    // Check for workbook properties
    if (isWorkbookObject(item)) {
      console.warn("Filtered out workbook object from assignments");
      return false;
    }

    // Must have the minimum required fields
    if (!item.title) {
      console.warn("Assignment missing title:", item);
      return false;
    }

    if (!item.dueDate) {
      console.warn("Assignment missing dueDate:", item);
      return false;
    }

    return true;
  });

  console.log(`After filtering: ${filteredAssignments.length} assignments remain`);

  // Then, create brand new clean objects with only the properties we want
  const cleanAssignments = filteredAssignments.map((item) => ({
    title: String(item.title || ""),
    dueDate: String(item.dueDate || ""),
    course: String(item.course || ""),
    description: String(item.description || ""),
    type: String(item.type || "Assignment"),
    fileName: item.fileName ? String(item.fileName) : undefined,
  }));

  return cleanAssignments;
}

// Helper to filter out workbook objects
function filterOutWorkbooks(data) {
  if (!Array.isArray(data)) return [];

  return data.filter((item) => {
    return !isWorkbookObject(item);
  });
}

function validateAssignments(assignments) {
  // Filter out any non-object assignments or workbook objects
  return assignments.filter((assignment) => {
    // Check if it's a plain object (not a workbook or other complex object)
    if (
      !assignment ||
      typeof assignment !== "object" ||
      Array.isArray(assignment)
    ) {
      console.warn("Filtered out non-object assignment:", assignment);
      return false;
    }

    // Check for workbook-specific properties that indicate we've got a workbook object instead of an assignment
    if (assignment.SheetNames || assignment.Sheets || assignment.Workbook) {
      console.warn("Found workbook object in assignments, filtering it out");
      return false;
    }

    // Check that it has the minimum required properties to be an assignment
    if (!assignment.title || !assignment.dueDate) {
      console.warn(
        "Filtered out incomplete assignment missing title or dueDate:",
        assignment,
      );
      return false;
    }

    return true;
  });
}
// Format data for Power Planner CSV export
function formatForPowerPlanner(assignments, courseOverride = "") {
  if (!assignments || assignments.length === 0) {
    return [];
  }

  return assignments
    .map((item) => {
      // Make sure we have valid data
      if (!item || typeof item !== "object") {
        console.warn("Invalid assignment data in formatForPowerPlanner:", item);
        return null;
      }

      return {
        Name: formatPowerPlannerTitle(item),
        Class: courseOverride || item.course || "Unknown Course",
        DueDate: formatPowerPlannerDate(item.dueDate || ""),
        Details: formatPowerPlannerDetails(item),
        Type: mapAssignmentType(item.type) || "Assignment",
      };
    })
    .filter(Boolean); // Remove any null entries
}

// Format title for Power Planner
function formatPowerPlannerTitle(item) {
  if (!item.title) return "Unnamed Assignment";

  // Make sure homework titles are properly formatted
  if (item.type === "Homework" && !item.title.includes("Homework")) {
    const hwNum = item.title.match(/\d+/);
    if (hwNum) {
      return `Homework ${hwNum[0]}`;
    }
  }

  // Make sure P&C activity titles are properly formatted
  if (item.type === "P&C Activity" && !item.title.includes("P&C Activity")) {
    const activityNum = item.title.match(/\d+/);
    if (activityNum) {
      return `P&C Activity ${activityNum[0]}`;
    }
  }

  return item.title;
}

// Format date for Power Planner
function formatPowerPlannerDate(dateStr) {
  try {
    if (!dateStr) return "";

    // If already in MM/DD/YYYY format, return as is
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      return dateStr;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return original if not valid

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } catch (e) {
    console.warn("Error formatting Power Planner date:", e);
    return dateStr; // Return original on error
  }
}

// Format details for Power Planner
function formatPowerPlannerDetails(item) {
  const details = [];

  if (item.description) {
    details.push(item.description);
  }

  if (item.fileName) {
    details.push(`Source: ${item.fileName}`);
  }

  return details.join("\n");
}

// Map assignment types to Power Planner compatible types
function mapAssignmentType(type) {
  if (!type) return "Assignment";

  // Power Planner supports these assignment types
  const typeMap = {
    Homework: "Homework",
    HW: "Homework",
    "P&C Activity": "Activity",
    "PC Activity": "Activity",
    Project: "Project",
    Exam: "Exam",
    Midterm: "Exam",
    "Midterm Exam": "Exam",
    Final: "Exam",
    "Final Exam": "Exam",
    Quiz: "Quiz",
    Test: "Test",
  };

  return typeMap[type] || type;
}

// Generate a CSV string from data
function generateCSV(data) {
  if (!data || data.length === 0) {
    return "No data to export";
  }

  try {
    return Papa.unparse(data);
  } catch (error) {
    console.error("Error generating CSV:", error);
    return `Error generating CSV: ${error.message}`;
  }
}

// Export to Power Planner
function exportToPowerPlanner(extractedData, courseOverride = "") {
  if (!extractedData || extractedData.length === 0) {
    console.warn("No data to export");
    return false;
  }

  try {
    // Format for Power Planner
    const formattedData = formatForPowerPlanner(extractedData, courseOverride);

    // Generate CSV
    const csv = generateCSV(formattedData);

    // Download
    downloadFile(csv, "power_planner_import.csv", "text/csv;charset=utf-8;");
    return true;
  } catch (error) {
    console.error("Error exporting to Power Planner:", error);
    return false;
  }
}

// Export to ICS calendar format
function exportToICS(extractedData) {
  if (!extractedData || extractedData.length === 0) {
    console.warn("No data to export to ICS");
    return false;
  }

  try {
    // Generate ICS calendar content
    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SyllabusSyncTool//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    // Add each assignment as an event
    let validEventCount = 0;

    for (const item of extractedData) {
      try {
        if (!item || !item.dueDate) continue;

        // Parse the due date
        const dueDate = new Date(item.dueDate);

        // Skip if invalid
        if (isNaN(dueDate.getTime())) continue;

        // Format to ICS date format
        const formatICSDate = (date) => {
          return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        };

        const icsDate = formatICSDate(dueDate);
        const uniqueId =
          Math.random().toString(36).substring(2) + Date.now().toString(36);

        // Add event
        icsContent.push(
          "BEGIN:VEVENT",
          `UID:${uniqueId}@syllabus-sync.app`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `DTSTART:${icsDate}`,
          `DTEND:${icsDate}`,
          `SUMMARY:${(item.title || "Assignment").replace(/[,;\\]/g, "\\$&")}`,
          `DESCRIPTION:${(item.description || "").replace(/[,;\\]/g, "\\$&")}`,
          `LOCATION:${(item.course || "").replace(/[,;\\]/g, "\\$&")}`,
          `CATEGORIES:${(item.type || "Assignment").replace(/[,;\\]/g, "\\$&")}`,
          "END:VEVENT",
        );

        validEventCount++;
      } catch (e) {
        console.warn("Could not add event to ICS:", e);
      }
    }

    // Close calendar
    icsContent.push("END:VCALENDAR");

    // Only download if we have valid events
    if (validEventCount > 0) {
      downloadFile(
        icsContent.join("\r\n"),
        "assignments_calendar.ics",
        "text/calendar",
      );
      return true;
    } else {
      console.warn("No valid events to export to ICS");
      return false;
    }
  } catch (error) {
    console.error("Error exporting to ICS:", error);
    return false;
  }
}

// Export to generic CSV format
function exportToCSV(extractedData) {
  if (!extractedData || extractedData.length === 0) {
    console.warn("No data to export to CSV");
    return false;
  }

  try {
    // Clean the data to ensure it's safe for CSV export
    const cleanedData = extractedData
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        // Create a new object with only the fields we want to export
        return {
          Title: item.title || "Unnamed Assignment",
          DueDate: item.dueDate || "",
          Course: item.course || "",
          Type: item.type || "Assignment",
          Description: item.description || "",
        };
      })
      .filter(Boolean);

    if (cleanedData.length === 0) {
      console.warn("No valid data to export to CSV after cleaning");
      return false;
    }

    // Generate and download CSV
    const csv = Papa.unparse(cleanedData);
    downloadFile(csv, "assignments_export.csv", "text/csv;charset=utf-8;");
    return true;
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    return false;
  }
}

// Generic file download function
function downloadFile(content, filename, contentType) {
  try {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Error downloading file:", error);
    return false;
  }
}

// Add this near the top of SyllabusSyncApp.js
// Enhanced debugging function to detect workbook objects anywhere in the data structure
function debugFindWorkbooks(data, path = "") {
  if (!data) return false;

  // Check if this is a workbook object
  if (
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data.SheetNames ||
      data.Sheets ||
      data.Workbook ||
      data.Props ||
      data.Deps ||
      data.Directory ||
      data.Custprops ||
      data.Strings ||
      data.Styles ||
      data.Themes ||
      data.SSF)
  ) {
    console.error(
      `FOUND WORKBOOK at ${path}`,
      Object.keys(data).reduce((acc, key) => {
        acc[key] = `[${typeof data[key]}]`;
        return acc;
      }, {}),
    );
    return true;
  }

  let foundWorkbook = false;

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (debugFindWorkbooks(item, `${path}[${index}]`)) {
        foundWorkbook = true;
      }
    });
  } else if (typeof data === "object" && data !== null) {
    // Recursively check object properties
    Object.keys(data).forEach((key) => {
      if (debugFindWorkbooks(data[key], `${path}.${key}`)) {
        foundWorkbook = true;
      }
    });
  }

  return foundWorkbook;
}

// Add this function for inserting in the processing pipeline
function deepSanitizeData(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  // Define all workbook properties to check for
  const workbookProps = [
    "SheetNames",
    "Sheets",
    "Workbook",
    "Props",
    "Deps",
    "Directory",
    "Custprops",
    "Strings",
    "Styles",
    "Themes",
    "SSF",
  ];

  // First pass - deep filter to remove obvious workbook objects
  let filteredData = data.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    for (const prop of workbookProps) {
      if (item.hasOwnProperty(prop)) {
        console.warn(`Found workbook property '${prop}', filtering out item`);
        return false;
      }
    }

    return true;
  });

  // Second pass - ensure all items have required properties
  filteredData = filteredData.filter((item) => {
    if (!item.title || !item.dueDate) {
      console.warn("Item missing required properties", item);
      return false;
    }
    return true;
  });

  // Log the results
  console.log(
    `Deep sanitize: ${filteredData.length} of ${data.length} passed verification`,
  );

  return filteredData;
}

export default function SyllabusSyncApp() {
  // State management
  const [files, setFiles] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState("powerplanner");
  const [error, setError] = useState(null);
  const [showPowerPlannerOptions, setShowPowerPlannerOptions] = useState(false);
  const [courseOverride, setCourseOverride] = useState("");

  useEffect(() => {
    // Debug check for workbooks in extractedData
    if (extractedData && extractedData.length > 0) {
      debugFindWorkbooks(extractedData, "extractedData");
    }
  }, [extractedData]);

  // Add direct filtering to state setter
  const safeSetExtractedData = (data) => {
    // Filter out any workbook objects before setting state
    if (Array.isArray(data)) {
      // Define all possible workbook properties to check for
      const workbookProps = [
        "SheetNames",
        "Sheets",
        "Workbook",
        "Props",
        "Deps",
        "Directory",
        "Custprops",
        "Strings",
        "Styles",
        "Themes",
        "SSF",
      ];

      const filteredData = data.filter((item) => {
        // Basic type checking
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          console.warn("Filtered out invalid item type:", typeof item);
          return false;
        }

        // Check for any workbook property
        for (const prop of workbookProps) {
          if (item.hasOwnProperty(prop)) {
            console.warn(
              `Found workbook property '${prop}' in data, filtering out item`,
            );
            return false;
          }
        }

        // Verify required properties exist
        if (!item.title || !item.dueDate) {
          console.warn("Filtered out item missing required properties");
          return false;
        }

        return true;
      });

      console.log(
        `Filtered data: ${filteredData.length} of ${data.length} items passed validation`,
      );
      setExtractedData(filteredData);
    } else {
      console.warn("Attempted to set non-array data:", data);
      setExtractedData([]);
    }
  };
  // Handle file upload
  const handleFilesUploaded = useCallback((newFiles) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    setError(null);
  }, []);

  // Handle file removal
  const handleRemoveFile = useCallback((index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  }, []);

  // Use the extractCourseCode function defined later in the file

  // Process Excel files
// Improved Excel processing function for SyllabusSyncApp.js

// Improved Excel processing function for SyllabusSyncApp.js

const processExcelFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log(`Processing Excel file: ${file.name}`);
        const data = new Uint8Array(e.target.result);

        // Read the Excel file with all options enabled for better parsing
        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,  // Ensure dates are parsed as Date objects
          cellStyles: true, // Keep cell styles for better formatting detection
          cellFormula: true, // Parse formulas
          dateNF: 'yyyy-mm-dd', // Date format
          cellNF: true, // Keep number formats
        });

        console.log(`File loaded, found ${workbook.SheetNames.length} sheets`);

        // Special handling for CMP168_Timeline.xlsx
        if (file.name.includes("CMP168_Timeline")) {
          console.log("Detected CMP168_Timeline file, using specialized parser");
          const cmp168Assignments = parseCMP168Timeline(workbook);
          
          if (cmp168Assignments.length > 0) {
            console.log(`Successfully extracted ${cmp168Assignments.length} assignments from CMP168 timeline`);
            
            // Add filename to each assignment
            const assignmentsWithFilename = cmp168Assignments.map(item => ({
              ...item,
              fileName: file.name
            }));
            
            resolve(assignmentsWithFilename);
            return;
          } else {
            console.warn("CMP168 specialized parser found no assignments, falling back to standard processing");
          }
        }

        // If we're here, either it's not CMP168 or the specialized parser found no assignments
        // Extract course name from filename
        const courseName = extractCourseCode(file.name);
        const currentYear = new Date().getFullYear();

        // Process assignments from all sheets
        const assignments = [];
        
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          try {
            // Skip sheets that look like they contain metadata/info
            if (/info|metadata|readme|about/i.test(sheetName)) {
              console.log(`Skipping metadata sheet: ${sheetName}`);
              continue;
            }

            const sheet = workbook.Sheets[sheetName];

            // Create a safe JSON representation of the sheet
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            // Skip empty sheets
            if (!jsonData || jsonData.length === 0) continue;

            console.log(`Processing sheet ${sheetName} with ${jsonData.length} rows`);

            // First try to detect if this is a timeline format
            const isTimeline = detectTimelineFormat(jsonData);
            
            if (isTimeline) {
              console.log(`Sheet ${sheetName} appears to be a timeline format`);
              
              // Process the sheet as a timeline format
              const timelineAssignments = parseTimelineSheet(jsonData, courseName, currentYear);
              
              if (timelineAssignments && timelineAssignments.length > 0) {
                console.log(`Found ${timelineAssignments.length} timeline assignments in ${sheetName}`);
                
                // Create clean assignment objects
                const cleanAssignments = timelineAssignments.map(item => ({
                  title: String(item.title || ""),
                  dueDate: String(item.dueDate || ""),
                  course: String(item.course || ""),
                  description: String(item.description || ""),
                  type: String(item.type || "Assignment"),
                  fileName: String(file.name)
                }));
                
                assignments.push(...cleanAssignments);
              }
            } else {
              // Process as standard format
              for (const row of jsonData) {
                // Skip empty rows
                if (!row || Object.keys(row).length === 0) continue;

                // Find due date in various column names
                const dueDate = findValueFromVariants(row, [
                  "Due Date", "Due", "Deadline", "Date", "DUE DATE", "Due date", "due date",
                  "Submission Date", "Submit By", "Due By"
                ]);

                // Skip if no due date
                if (!dueDate) continue;

                // Parse the date
                const parsedDate = parseDate(dueDate, currentYear);

                // Skip invalid dates or dates in the past
                if (!parsedDate || isDateInPast(parsedDate)) continue;

                // Format the date
                const formattedDate = formatDate(parsedDate);

                // Get title from various column names
                const title = findValueFromVariants(row, [
                  "Title", "Assignment", "Task", "Name", "Description", "Assignment Name",
                  "Homework", "Project", "Activity"
                ]) || "Unnamed Assignment";

                // Get description from various column names
                const description = findValueFromVariants(row, [
                  "Description", "Details", "Notes", "Instructions", "Content"
                ]) || "";

                // Get type from various column names
                const type = findValueFromVariants(row, [
                  "Type", "Category", "Assignment Type", "Kind"
                ]) || "Assignment";

                // Create a clean assignment object
                assignments.push({
                  title: String(title),
                  dueDate: String(formattedDate),
                  course: String(findValueFromVariants(row, ["Course", "Class", "Subject"]) || courseName),
                  description: String(description),
                  type: String(type),
                  fileName: String(file.name),
                });
              }
            }
          } catch (sheetError) {
            console.warn(`Error processing sheet ${sheetName}:`, sheetError);
            // Continue to next sheet
          }
        }

        console.log(`Total assignments found in ${file.name}: ${assignments.length}`);
        
        if (assignments.length === 0) {
          console.warn(`No assignments found in ${file.name}. This might indicate a format issue.`);
        }
        
        resolve(assignments);
      } catch (error) {
        console.error("Error processing Excel data:", error);
        reject(new Error(`Failed to process Excel file: ${error.message}`));
      }
    };

    reader.onerror = (error) => {
      reject(new Error(`FileReader error: ${error.message || "Unknown error"}`));
    };

    reader.readAsArrayBuffer(file);
  });
};

// Helper function to detect timeline format
function detectTimelineFormat(jsonData) {
  if (!jsonData || jsonData.length === 0) return false;
  
  // Look at the first row to see if it has timeline-like columns
  const firstRow = jsonData[0];
  if (!firstRow) return false;
  
  const keys = Object.keys(firstRow);
  
  // Check if the keys contain common timeline columns
  return keys.some(key => 
    key.includes('Date') || 
    key.includes('Week') || 
    key.includes('Day') || 
    key.includes('Session') ||
    key.includes('Due By') ||
    key.includes('Topic')
  );
}

// Helper function to parse timeline sheets
// function parseTimelineSheet(jsonData, courseName, currentYear) {
//   const assignments = [];
  
//   // Process each row
//   for (const row of jsonData) {
//     // Skip if not a valid row
//     if (!row || typeof row !== 'object') continue;
    
//     // Find a date in the row - try various date column patterns
//     let dateValue = null;
//     let dateColumn = null;
    
//     // Check various date column patterns
//     for (const key of Object.keys(row)) {
//       if (key.includes('Date') || key.includes('Due') || key.includes('Deadline')) {
//         dateValue = row[key];
//         dateColumn = key;
//         break;
//       }
//     }
    
//     // If no specific date column found, check other columns for date-like values
//     if (!dateValue) {
//       for (const [key, value] of Object.entries(row)) {
//         if (value && (typeof value === 'string' || typeof value === 'number')) {
//           try {
//             const possibleDate = parseDate(value, currentYear);
//             if (possibleDate && !isNaN(possibleDate.getTime())) {
//               dateValue = value;
//               dateColumn = key;
//               break;
//             }
//           } catch (e) {
//             // Not a date, continue checking
//           }
//         }
//       }
//     }
    
//     // Skip row if no valid date found
//     if (!dateValue) continue;
    
//     // Parse the date
//     const rowDate = parseDate(dateValue, currentYear);
    
//     // Skip invalid dates or dates in the past
//     if (!rowDate || isDateInPast(rowDate)) continue;
    
//     const formattedDate = formatDate(rowDate);
    
//     // Look for assignments in this row
    
//     // Check all columns for potential assignments
//     for (const [key, value] of Object.entries(row)) {
//       // Skip the date column we already processed
//       if (key === dateColumn) continue;
      
//       // Skip if not a string or is empty
//       if (!value || typeof value !== 'string' || value.trim() === '') continue;
      
//       const lowerValue = value.toLowerCase();
//       const lowerKey = key.toLowerCase();
      
//       // Check for homework
//       if (lowerKey.includes('homework') || lowerKey.includes('hw') || 
//           lowerValue.includes('homework') || lowerValue.includes('hw')) {
        
//         let title = "Homework";
//         // Try to extract homework number
//         const hwMatch = lowerValue.match(/(?:homework|hw)\s*(?:#|\s)?(\d+)/i);
//         if (hwMatch) {
//           title = `Homework ${hwMatch[1]}`;
//         }
        
//         assignments.push({
//           title,
//           dueDate: formattedDate,
//           course: courseName,
//           description: value,
//           type: "Homework"
//         });
//       }
//       // Check for projects
//       else if (lowerKey.includes('project') || lowerValue.includes('project')) {
//         let title = "Project";
//         // Try to extract project number
//         const projMatch = lowerValue.match(/project\s*(?:#|\s)?(\d+)/i);
//         if (projMatch) {
//           title = `Project ${projMatch[1]}`;
//         }
        
//         assignments.push({
//           title,
//           dueDate: formattedDate,
//           course: courseName,
//           description: value,
//           type: "Project"
//         });
//       }
//       // Check for activities
//       else if (lowerKey.includes('activity') || lowerValue.includes('activity') ||
//                lowerKey.includes('p&c') || lowerValue.includes('p&c')) {
        
//         let title = "Activity";
//         // Try to extract activity number
//         const actMatch = lowerValue.match(/(?:activity|p&c)\s*(?:#|\s)?(\d+)/i);
//         if (actMatch) {
//           title = `Activity ${actMatch[1]}`;
//         }
        
//         assignments.push({
//           title,
//           dueDate: formattedDate,
//           course: courseName,
//           description: value,
//           type: "Activity"
//         });
//       }
//       // Check for exams
//       else if (lowerKey.includes('exam') || lowerValue.includes('exam') ||
//                lowerKey.includes('test') || lowerValue.includes('test') ||
//                lowerKey.includes('quiz') || lowerValue.includes('quiz')) {
        
//         let title = "Exam";
//         let type = "Exam";
        
//         if (lowerValue.includes('midterm')) {
//           title = "Midterm Exam";
//         } else if (lowerValue.includes('final')) {
//           title = "Final Exam";
//         } else if (lowerValue.includes('quiz')) {
//           title = "Quiz";
//           type = "Quiz";
//         }
        
//         assignments.push({
//           title,
//           dueDate: formattedDate,
//           course: courseName,
//           description: value,
//           type
//         });
//       }
//     }
//   }
  
//   return assignments;
// }

// Utility function to find values from multiple possible column names
// function findValueFromVariants(row, variants) {
//   if (!row || typeof row !== 'object') return null;
  
//   for (const variant of variants) {
//     // Check exact match
//     if (row[variant] !== undefined && row[variant] !== null && row[variant] !== "") {
//       return row[variant];
//     }
    
//     // Also check case-insensitive variants
//     const lowerVariant = variant.toLowerCase();
//     for (const key in row) {
//       if (key.toLowerCase() === lowerVariant && 
//           row[key] !== undefined && row[key] !== null && row[key] !== "") {
//         return row[key];
//       }
//     }
//   }
//   return null;
// }

// Extract course code from filename
function extractCourseCode(fileName) {
  // Regular expression to match common course code patterns (e.g., CS101, MATH 240)
  const courseMatch = fileName.match(/([A-Z]{2,4})\s*(\d{3,4})/i);
  if (courseMatch) {
    return `${courseMatch[1]} ${courseMatch[2]}`;
  }

  // If no match, return just the filename without extension
  return fileName.split(".")[0];
}

// Improved utility function to find values from multiple possible column names
const findValueFromVariants = (row, variants) => {
  if (!row || typeof row !== 'object') return null;
  
  for (const variant of variants) {
    // Check exact match
    if (row[variant] !== undefined && row[variant] !== null && row[variant] !== "") {
      return row[variant];
    }
    
    // Also check case-insensitive variants
    const lowerVariant = variant.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerVariant && 
          row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key];
      }
    }
  }
  return null;
};

  const isTimelineFormat = (sheet) => {
    // Check if the first few rows contain specific headers like in Image 2
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
    const headerText = headers.join(" ").toLowerCase();

    return (
      headerText.includes("p&c due by") ||
      headerText.includes("hw due by") ||
      (headerText.includes("date") && headerText.includes("week"))
    );
  };

  // Add a specialized parser for the timeline format
  const parseTimelineSheet = (sheet, courseName, currentYear) => {
    const assignments = [];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    jsonData.forEach((row) => {
      // Look for P&C Activities
      if (row["P&C Due By 11:59 PM On Specified Date"]) {
        assignments.push({
          title: `P&C Activity ${extractActivityNumber(row)}`,
          dueDate: formatDate(
            parseDate(row["P&C Due By 11:59 PM On Specified Date"]),
          ),
          course: courseName,
          description: extractTopicDescription(row),
          type: "P&C Activity",
        });
      }

      // Look for Homework
      if (row["HW Due By 11:59 PM On Specified Date"]) {
        assignments.push({
          title: `Homework ${extractHomeworkNumber(row)}`,
          dueDate: formatDate(
            parseDate(row["HW Due By 11:59 PM On Specified Date"]),
          ),
          course: courseName,
          description: extractTopicDescription(row),
          type: "Homework",
        });
      }

      // Look for exams in the topic columns
      if (
        row["Lecture Topic T,Th"] &&
        row["Lecture Topic T,Th"].toLowerCase().includes("exam")
      ) {
        assignments.push({
          title: extractExamTitle(row["Lecture Topic T,Th"]),
          dueDate: formatDate(parseDate(row["Date"])),
          course: courseName,
          description: row["Lecture Topic T,Th"],
          type: "Exam",
        });
      }

      // Look for projects
      if (
        row["Lab Session Topic"] &&
        row["Lab Session Topic"].toLowerCase().includes("project")
      ) {
        assignments.push({
          title: extractProjectTitle(row["Lab Session Topic"]),
          dueDate: formatDate(parseDate(row["Date"])),
          course: courseName,
          description: row["Lab Session Topic"],
          type: "Project",
        });
      }
    });

    return assignments;
  };

  // Helper function to extract activity number
  const extractActivityNumber = (row) => {
    // Look in lecture topic or other columns
    const text = row["Lecture Topic T,Th"] || "";
    const match = text.match(/P&C Activity (\d+)/i);
    return match ? match[1] : "";
  };

  // Helper function to extract homework number
  const extractHomeworkNumber = (row) => {
    const text = row["Lecture Topic T,Th"] || "";
    const match = text.match(/HW (\d+)/i);
    return match ? match[1] : "";
  };

  // Helper function to extract exam title
  const extractExamTitle = (text) => {
    if (!text) return "Exam";

    if (text.toLowerCase().includes("midterm")) {
      return "Midterm Exam";
    } else if (text.toLowerCase().includes("final")) {
      return "Final Exam";
    }

    return "Exam";
  };

  // Helper function to extract project title
  const extractProjectTitle = (text) => {
    if (!text) return "Project";

    const match = text.match(/PROJECT (\d+)/i);
    return match ? `Project ${match[1]}` : "Project";
  };

  // Helper function to extract topic description
  const extractTopicDescription = (row) => {
    let description = "";

    if (row["Lecture Topic T,Th"]) {
      description += row["Lecture Topic T,Th"];
    }

    if (row["Lab Session Topic"]) {
      if (description) description += " - ";
      description += row["Lab Session Topic"];
    }

    return description;
  };

  // Analyze sheet structure to identify important columns
  const analyzeSheetStructure = (jsonData) => {
    const columnMap = {
      dateColumn: -1,
      hwColumns: [],
      pcColumns: [],
      projectColumns: [],
      examColumns: [],
      topicColumns: [],
    };

    // Look at the header row first (typically row 0)
    const headerRow = jsonData[0];
    if (!headerRow) return columnMap;

    for (let i = 0; i < headerRow.length; i++) {
      if (!headerRow[i]) continue;

      const header = headerRow[i].toString().toLowerCase();

      if (header.includes("date")) {
        columnMap.dateColumn = i;
      } else if (header.includes("topic") || header.includes("lecture")) {
        columnMap.topicColumns.push(i);
      } else if (header.includes("hw") || header.includes("homework")) {
        columnMap.hwColumns.push(i);
      } else if (header.includes("p&c") || header.includes("activity")) {
        columnMap.pcColumns.push(i);
      } else if (header.includes("project")) {
        columnMap.projectColumns.push(i);
      } else if (
        header.includes("exam") ||
        header.includes("midterm") ||
        header.includes("final")
      ) {
        columnMap.examColumns.push(i);
      }
    }

    // If no date column found, try to guess it (common in academic schedules)
    if (columnMap.dateColumn === -1) {
      // Try column 0 or 1, common positions for dates
      columnMap.dateColumn = 1;
    }

    // Second pass through a few rows to find columns that contain assignment indicators
    if (
      columnMap.hwColumns.length === 0 ||
      columnMap.pcColumns.length === 0 ||
      columnMap.projectColumns.length === 0 ||
      columnMap.examColumns.length === 0
    ) {
      // Check first 5 rows for common patterns
      for (let rowIdx = 1; rowIdx < Math.min(5, jsonData.length); rowIdx++) {
        const row = jsonData[rowIdx];
        if (!row) continue;

        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cell = row[colIdx];
          if (!cell || typeof cell !== "string") continue;

          const cellText = cell.toLowerCase();

          if (cellText.includes("hw") || cellText.includes("homework")) {
            if (!columnMap.hwColumns.includes(colIdx)) {
              columnMap.hwColumns.push(colIdx);
            }
          }

          if (cellText.includes("p&c") || cellText.includes("activity")) {
            if (!columnMap.pcColumns.includes(colIdx)) {
              columnMap.pcColumns.push(colIdx);
            }
          }

          if (cellText.includes("project")) {
            if (!columnMap.projectColumns.includes(colIdx)) {
              columnMap.projectColumns.push(colIdx);
            }
          }

          if (
            cellText.includes("exam") ||
            cellText.includes("midterm") ||
            cellText.includes("final")
          ) {
            if (!columnMap.examColumns.includes(colIdx)) {
              columnMap.examColumns.push(colIdx);
            }
          }
        }
      }
    }

    return columnMap;
  };

  // Get topic text from row
  const getTopicText = (row, columnMap) => {
    if (columnMap.topicColumns.length === 0) return "";

    let topicText = "";
    for (const col of columnMap.topicColumns) {
      if (row[col] && typeof row[col] === "string") {
        if (topicText) topicText += " - ";
        topicText += row[col];
      }
    }

    return topicText;
  };

  // Process CSV files
  const processCSVFile = async (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          try {
            if (results.errors && results.errors.length > 0) {
              console.warn("CSV parsing had errors:", results.errors);
            }

            // Extract course name from filename
            const courseName = extractCourseCode(file.name);

            // Process the data
            const assignments = [];

            for (const row of results.data) {
              // Skip empty rows
              if (!row || Object.keys(row).length === 0) continue;

              // Find due date in various column names
              const dueDate = findValueFromVariants(row, [
                "Due Date",
                "Due",
                "Deadline",
                "Date",
              ]);

              // Skip if no due date
              if (!dueDate) continue;

              // Parse the date
              const parsedDate = parseDate(dueDate);

              // Skip invalid dates or dates in the past
              if (!parsedDate || isDateInPast(parsedDate)) continue;

              // Format the date
              const formattedDate = formatDate(parsedDate);

              // Get title from various column names
              const title =
                findValueFromVariants(row, [
                  "Title",
                  "Assignment",
                  "Task",
                  "Name",
                ]) || "Unnamed Assignment";

              // Get description from various column names
              const description =
                findValueFromVariants(row, [
                  "Description",
                  "Details",
                  "Notes",
                ]) || "";

              // Get type from various column names
              const type =
                findValueFromVariants(row, ["Type", "Category"]) ||
                "Assignment";

              // Add to assignments
              assignments.push({
                title,
                dueDate: formattedDate,
                course:
                  findValueFromVariants(row, ["Course", "Class"]) || courseName,
                description,
                type,
                fileName: file.name,
              });
            }

            resolve(assignments);
          } catch (error) {
            console.error("Error processing CSV data:", error);
            reject(new Error(`Failed to process CSV data: ${error.message}`));
          }
        },
        error: (error) => {
          console.error("Papa Parse error:", error);
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    });
  };

  // Export functions
  const downloadFile = (content, filename, contentType) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to Power Planner
  const exportToPowerPlanner = () => {
    if (!extractedData || extractedData.length === 0) return;

    // Format for Power Planner
    const formattedData = formatForPowerPlanner(extractedData, courseOverride);

    // Generate CSV
    const csv = generateCSV(formattedData);

    // Download
    downloadFile(csv, "power_planner_import.csv", "text/csv;charset=utf-8;");
  };

  // Export to generic CSV
  const exportToCSV = () => {
    if (!extractedData || extractedData.length === 0) return;

    // Simple CSV export
    const csv = Papa.unparse(extractedData);

    // Download
    downloadFile(csv, "assignments_export.csv", "text/csv;charset=utf-8;");
  };

  // Export to ICS calendar
  const exportToICS = () => {
    if (!extractedData || extractedData.length === 0) return;

    // Generate ICS calendar content
    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SyllabusSyncTool//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    // Add each assignment as an event
    for (const item of extractedData) {
      try {
        // Parse the due date
        const dueDate = new Date(item.dueDate);

        // Skip if invalid
        if (isNaN(dueDate.getTime())) continue;

        // Format to ICS date format
        const formatICSDate = (date) => {
          return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        };

        const icsDate = formatICSDate(dueDate);

        // Add event
        icsContent.push(
          "BEGIN:VEVENT",
          `UID:${uniqueId}@syllabus-sync.app`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `DTSTART:${icsDate}`,
          `DTEND:${icsDate}`,
          `SUMMARY:${item.title || "Assignment"}`,
          `DESCRIPTION:${item.description || ""}`,
          `LOCATION:${item.course || ""}`,
          `CATEGORIES:${item.type || "Assignment"}`,
          "END:VEVENT",
        );
      } catch (e) {
        console.warn("Could not add event to ICS:", e);
      }
    }

    // Close calendar
    icsContent.push("END:VCALENDAR");

    // Download
    downloadFile(
      icsContent.join("\r\n"),
      "assignments_calendar.ics",
      "text/calendar",
    );
  };

  // Handle export button click
  // Handle export button click
  const handleExport = () => {
    if (extractedData.length === 0) return;

    try {
      if (exportFormat === "powerplanner") {
        setShowPowerPlannerOptions(true);
      } else if (exportFormat === "ics") {
        const success = exportToICS(extractedData);
        if (!success) {
          setError("Failed to export ICS file: No valid assignments found");
        }
      } else if (exportFormat === "csv") {
        const success = exportToCSV(extractedData);
        if (!success) {
          setError("Failed to export CSV file: No valid assignments found");
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      setError(`Export failed: ${err.message}`);
    }
  };

  // Process all uploaded files
  // Process all uploaded files
  const processFiles = async () => {
    if (!files || files.length === 0) {
      setError("Please upload files first");
      return;
    }
  
    setIsProcessing(true);
    setError(null);
    setExtractedData([]); // Clear existing data
  
    try {
      const allAssignments = [];
      let processingErrors = [];
  
      for (const file of files) {
        try {
          const fileType = file.name.split(".").pop().toLowerCase();
  
          let fileAssignments = [];
          if (fileType === "xlsx" || fileType === "xls") {
            fileAssignments = await processExcelFile(file);
          } else if (fileType === "csv") {
            fileAssignments = await processCSVFile(file);
          } else {
            console.warn(`Unsupported file type: ${fileType}`);
            processingErrors.push(`${file.name}: Unsupported file type. Please upload Excel (.xlsx, .xls) or CSV files.`);
            continue;
          }
  
          // Validate and sanitize assignments immediately after processing each file
          if (Array.isArray(fileAssignments) && fileAssignments.length > 0) {
            console.log(`Found ${fileAssignments.length} raw assignments in ${file.name}`);
            const cleanAssignments = sanitizeAssignmentData(fileAssignments);
            console.log(`After sanitizing: ${cleanAssignments.length} valid assignments in ${file.name}`);
            
            if (cleanAssignments.length === 0) {
              processingErrors.push(`${file.name}: Could not extract any valid assignments. Please check the file format.`);
            } else {
              allAssignments.push(...cleanAssignments);
            }
          } else {
            processingErrors.push(`${file.name}: No assignments found. Please check if the file contains assignment data.`);
          }
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          processingErrors.push(`${file.name}: ${fileError.message}`);
        }
      }
  
      if (allAssignments.length === 0) {
        if (processingErrors.length > 0) {
          setError(`No valid assignments found in the uploaded files:\n${processingErrors.join('\n')}`);
        } else {
          setError("No valid assignments found in the uploaded files. Please check that your files contain assignment data with due dates.");
        }
        setExtractedData([]);
        return;
      }
  
      console.log(`Found ${allAssignments.length} total valid assignments across all files`);
  
      // Final sanitization and deduplication
      const uniqueAssignments = removeDuplicateAssignments(allAssignments);
      uniqueAssignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  
      console.log(`After deduplication: ${uniqueAssignments.length} unique assignments`);
      setExtractedData(uniqueAssignments);
      
      // Show warnings if there were some processing errors but we still found assignments
      if (processingErrors.length > 0) {
        setError(`Warning: Some files had processing issues:\n${processingErrors.join('\n')}`);
      }
    } catch (err) {
      console.error("Error processing files:", err);
      setError(`Failed to process files: ${err.message}`);
      setExtractedData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove duplicate assignments
  const removeDuplicateAssignments = (assignments) => {
    const uniqueAssignments = [];
    const seen = new Set();

    for (const assignment of assignments) {
      const key = `${assignment.title}-${assignment.dueDate}-${assignment.course}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueAssignments.push(assignment);
      }
    }

    return uniqueAssignments;
  };

  // Here, add the render method that was previously in the second function
  return (
    <div className="flex flex-col space-y-8 max-w-6xl mx-auto">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Syllabus &amp; Assignment Sync Tool
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Upload your course files to extract assignments, then export them to
          your favorite planning tool
        </p>
      </header>

      <section className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Upload Files
        </h2>

        <FileUploader
          onFilesUploaded={handleFilesUploaded}
          files={files}
          onRemoveFile={handleRemoveFile}
        />

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
            <div className="font-medium">Processing Error</div>
            <div>{error}</div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={processFiles}
            disabled={files.length === 0 || isProcessing}
            className={`inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white
            ${
              files.length === 0 || isProcessing
                ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }`}
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing Files...
              </>
            ) : (
              "Extract Assignments"
            )}
          </button>
        </div>
      </section>
      <HelpSection />

      {extractedData.length > 0 && (
        <>
          <section className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden p-6 border border-gray-200 dark:border-gray-700">
            <AssignmentTable assignments={extractedData} />
          </section>

          <section className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden p-6 border border-gray-200 dark:border-gray-700">
            <ExportOptions
              exportFormat={exportFormat}
              setExportFormat={setExportFormat}
              onExport={handleExport}
              disabled={extractedData.length === 0}
            />
          </section>

          {showPowerPlannerOptions && (
            <section className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Power Planner Export Options
              </h2>

              <div className="mb-4">
                <label
                  htmlFor="course-override"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Override Course Name (Optional)
                </label>
                <input
                  id="course-override"
                  type="text"
                  value={courseOverride}
                  onChange={(e) => setCourseOverride(e.target.value)}
                  placeholder="e.g. CMP 168"
                  className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use original course names from the file
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() =>
                    exportToPowerPlanner(extractedData, courseOverride)
                  }
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Export to Power Planner
                </button>

                <button
                  onClick={() => setShowPowerPlannerOptions(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                <h3 className="font-medium mb-2">
                  Power Planner Import Instructions:
                </h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Export the file using the button above</li>
                  <li>Open the Power Planner app on your device</li>
                  <li>Go to Settings &gt; Import Data</li>
                  <li>Select the exported CSV file</li>
                  <li>Review the imported assignments and confirm</li>
                </ol>
              </div>
            </section>
          )}
        </>
      )}

      <section className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          How to use this tool
        </h2>
        <ol className="space-y-3 text-gray-700 dark:text-gray-300 list-decimal pl-5">
          <li>Upload your syllabus or assignment files (Excel or CSV)</li>
          <li>Click "Extract Assignments" to process the files</li>
          <li>Review the extracted assignments in the table</li>
          <li>
            Choose your preferred export format (Power Planner, Calendar, or
            CSV)
          </li>
          <li>Click "Export Data" to download the file</li>
          <li>Import the exported file into your planning tool of choice</li>
        </ol>
      </section>

      <footer className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
        <p>
          Syllabus Sync Tool &copy; {new Date().getFullYear()} | Easily extract
          and organize your course assignments
        </p>
      </footer>
    </div>
  );
}
