"use client";
import React, { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import FileUploader from "./FileUploader";
import AssignmentTable from "./AssignmentTable";
import ExportOptions from "./ExportOptions";
import PowerPlannerExport from "./PowerPlannerExport";
import {
  parseDate,
  formatDate,
  isDateInPast,
  extractYearFromSheetName,
  isTimelineFormat,
} from "./DateUtils";
import { processTimelineExcelFile } from "./TimelineParser";

const SyllabusSyncApp = () => {
  const [files, setFiles] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState("powerplanner");
  const [error, setError] = useState(null);
  const [showPowerPlannerExport, setShowPowerPlannerExport] = useState(false);
  const [courseOverride, setCourseOverride] = useState("");

  // Create refs to avoid the circular dependencies in useCallback
  const extractedDataRef = useRef([]);

  // Update ref when state changes
  React.useEffect(() => {
    extractedDataRef.current = extractedData;
  }, [extractedData]);

  // Helper functions
  const extractCourseName = (fileName) => {
    // Remove extension
    const nameWithoutExt = fileName.split(".")[0];

    // Try to extract course code patterns (e.g., CS101, MATH 240, etc.)
    const courseCodeMatch = nameWithoutExt.match(/([A-Z]{2,4})\s*(\d{3,4})/i);
    if (courseCodeMatch) {
      return courseCodeMatch[0];
    }

    // Fall back to the file name without extension
    return nameWithoutExt;
  };

  // Helper function to format dates into Power Planner's expected format
  const formatDateForPowerPlanner = useCallback((dateString) => {
    try {
      // Handle various date formats
      let date;
      if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        // MM/DD/YYYY format
        date = new Date(dateString);
      } else if (dateString.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        // YYYY-MM-DD format
        date = new Date(dateString);
      } else {
        // Try to parse other formats or return as is if can't parse
        date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return dateString;
        }
      }

      // Format as MM/DD/YYYY which Power Planner accepts
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString;
    }
  }, []);

  const downloadFile = useCallback((content, filename, contentType) => {
    try {
      const blob = new Blob([content], {
        type: `${contentType};charset=utf-8;`,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      setError(`Failed to download file: ${err.message}`);
    }
  }, []);

  // Export functions defined outside of useCallback to avoid circular dependencies
  const exportToPowerPlanner = useCallback(() => {
    try {
      const data = extractedDataRef.current;
      if (!data || data.length === 0) return;

      // Format data according to Power Planner's CSV import format
      const powerPlannerFormat = data.map((item) => ({
        Name: item.title || "Unnamed Assignment",
        Class: courseOverride || item.course || "Unknown Course",
        DueDate: formatDateForPowerPlanner(item.dueDate || ""),
        Details: item.description || "",
        Type: mapAssignmentType(item.type) || "Assignment",
      }));

      // Convert to CSV
      const csv = Papa.unparse(powerPlannerFormat);
      downloadFile(csv, "power_planner_import.csv", "text/csv");
    } catch (err) {
      console.error("Error exporting to Power Planner:", err);
      setError(`Failed to export to Power Planner: ${err.message}`);
    }
  }, [downloadFile, formatDateForPowerPlanner, courseOverride]);

  // Map assignment types to Power Planner compatible types
  const mapAssignmentType = (type) => {
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
  };

  const exportToCSV = useCallback(() => {
    try {
      const data = extractedDataRef.current;
      if (!data || data.length === 0) return;

      // Generic CSV export with all fields
      const csv = Papa.unparse(data);
      downloadFile(csv, "assignments_export.csv", "text/csv");
    } catch (err) {
      console.error("Error exporting to CSV:", err);
      setError(`Failed to export to CSV: ${err.message}`);
    }
  }, [downloadFile]);

  const exportToICS = useCallback(() => {
    try {
      const data = extractedDataRef.current;
      if (!data || data.length === 0) return;

      // Simple ICS calendar generation
      let icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SyllabusSyncTool//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
      ];

      data.forEach((item) => {
        try {
          // Try to parse the date
          const dueDate = new Date(item.dueDate || "");

          // Skip items with invalid dates
          if (isNaN(dueDate.getTime())) return;

          // Format date as required by ICS
          const formatDate = (date) => {
            return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
          };

          const formattedDate = formatDate(dueDate);

          icsContent.push(
            "BEGIN:VEVENT",
            `UID:${Math.random().toString(36).substring(2)}@syllabus-sync.app`,
            `DTSTAMP:${formatDate(new Date())}`,
            `DTSTART:${formattedDate}`,
            `DTEND:${formattedDate}`,
            `SUMMARY:${item.title || "Unnamed Assignment"}`,
            `DESCRIPTION:${item.description || ""}`,
            `LOCATION:${item.course || "Unknown Course"}`,
            `CATEGORIES:${item.type || "Assignment"}`,
            "END:VEVENT",
          );
        } catch (err) {
          console.warn(`Could not add event to ICS file: ${err.message}`);
        }
      });

      icsContent.push("END:VCALENDAR");

      downloadFile(
        icsContent.join("\r\n"),
        "assignments_calendar.ics",
        "text/calendar",
      );
    } catch (err) {
      console.error("Error exporting to ICS:", err);
      setError(`Failed to export to ICS: ${err.message}`);
    }
  }, [downloadFile]);

  const handleExport = useCallback(() => {
    if (extractedDataRef.current.length === 0) return;

    try {
      if (exportFormat === "powerplanner") {
        setShowPowerPlannerExport(true);
      } else if (exportFormat === "ics") {
        exportToICS();
      } else if (exportFormat === "csv") {
        exportToCSV();
      }
    } catch (err) {
      console.error("Export error:", err);
      setError(`Failed to export data: ${err.message}`);
    }
  }, [exportFormat, exportToICS, exportToCSV]);

  const processCSVFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided"));
        return;
      }

      try {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            try {
              if (results.errors && results.errors.length > 0) {
                console.warn("CSV parsing had errors:", results.errors);
              }

              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const assignments = results.data
                .filter(
                  (row) =>
                    row &&
                    typeof row === "object" &&
                    Object.keys(row).length > 0,
                )
                .map((row) => {
                  // Extract the due date
                  const dueDate =
                    row.Due || row["Due Date"] || row.Deadline || row.Date;

                  // Skip if no due date
                  if (!dueDate) return null;

                  // Parse the date
                  const parsedDate = new Date(dueDate);

                  // Skip if date is invalid or in the past
                  if (isNaN(parsedDate.getTime()) || parsedDate < today) {
                    return null;
                  }

                  // Format the date
                  const formattedDate = `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;

                  return {
                    title:
                      row.Assignment ||
                      row.Title ||
                      row.Task ||
                      row.Name ||
                      "Unnamed Assignment",
                    dueDate: formattedDate,
                    course:
                      row.Course || row.Class || extractCourseName(file.name),
                    description:
                      row.Description || row.Details || row.Notes || "",
                    type: row.Type || row.Category || "Assignment",
                    fileName: file.name,
                  };
                })
                .filter((item) => item !== null);

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
      } catch (error) {
        console.error("Error in CSV processing setup:", error);
        reject(new Error(`CSV processing setup error: ${error.message}`));
      }
    });
  }, []);

  const handleFilesUploaded = useCallback((acceptedFiles) => {
    if (!acceptedFiles || !Array.isArray(acceptedFiles)) return;

    setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    // Clear any previous errors when new files are uploaded
    setError(null);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  }, []);

  const handlePowerPlannerExport = useCallback(() => {
    exportToPowerPlanner();
    setShowPowerPlannerExport(false);
  }, [exportToPowerPlanner]);

  const processFiles = async () => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    const results = [];

    try {
      for (const file of files) {
        if (!file || !file.name) continue;

        try {
          const fileType = file.name.split(".").pop().toLowerCase();
          let assignmentData = [];

          if (fileType === "xlsx" || fileType === "xls") {
            const reader = new FileReader();
            const buffer = await new Promise((resolve, reject) => {
              reader.onload = (e) => resolve(e.target.result);
              reader.onerror = (e) => reject(e);
              reader.readAsArrayBuffer(file);
            });

            const fileData = new Uint8Array(buffer);
            const workbook = XLSX.read(fileData, {
              type: "array",
              cellDates: true,
              cellStyles: true,
            });

            // Extract course code from filename
            const courseMatch = file.name.match(/([A-Z]{2,4})\s*(\d{3,4})/i);
            const courseName = courseMatch
              ? courseMatch[0]
              : file.name.split(".")[0];

            console.log(
              `Processing file: ${file.name} for course: ${courseName}`,
            );

            // Check if this is a timeline format file
            if (isTimelineFormat(workbook)) {
              console.log("Detected timeline format, using specialized parser");
              try {
                // Use the specialized timeline parser
                const timelineAssignments = await processTimelineExcelFile(
                  file,
                  XLSX,
                  true,
                );
                assignmentData = timelineAssignments;
              } catch (timelineError) {
                console.error(
                  "Timeline parser failed, falling back to standard parser:",
                  timelineError,
                );
                // Fall back to standard processing if timeline parser fails
              }
            }

            // If timeline parser didn't yield results, use standard parser
            if (assignmentData.length === 0) {
              // Get current date for filtering
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              // Improved assignment tracking to avoid duplicates
              const processedAssignments = new Set();

              // Process each sheet
              for (const sheetName of workbook.SheetNames) {
                console.log(`Processing sheet: ${sheetName}`);
                // Extract sheet year if present (for date context)
                const sheetYear = extractYearFromSheetName(sheetName);

                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                  header: 1,
                });

                // Skip empty sheets
                if (!jsonData || jsonData.length <= 1) continue;

                // Process each row
                for (let i = 0; i < jsonData.length; i++) {
                  const row = jsonData[i];
                  if (!row || !Array.isArray(row)) continue;

                  // First, check if any cell in the row contains a date
                  let rowDate = null;
                  for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (cell instanceof Date) {
                      rowDate = new Date(cell);
                      rowDate.setHours(0, 0, 0, 0);
                      break;
                    }
                  }

                  // Get topic/context for this row
                  let topic = "";
                  if (row[5] && typeof row[5] === "string") {
                    topic = row[5];
                  } else if (row[7] && typeof row[7] === "string") {
                    topic = row[7];
                  }

                  // Process each cell that might contain assignment data
                  for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (!cell || typeof cell !== "string") continue;

                    // Skip processing cells that don't look like they contain assignments
                    if (
                      !/hw|homework|p&c|project|exam|midterm|final|quiz|assignment|due/i.test(
                        cell,
                      )
                    ) {
                      continue;
                    }

                    // Process due dates using DateUtils
                    let dueDate = null;
                    let title = cell;
                    let type = "Assignment";
                    let description = topic || "";

                    // Use DateUtils to parse and validate dates
                    if (/p&c/i.test(cell.toLowerCase())) {
                      // Use specialized P&C Activity handler from DateUtils
                      type = "P&C Activity";
                      dueDate = parseDate(cell, sheetYear);

                      // If no explicit date found, try to extract it
                      if (!dueDate && rowDate) {
                        // Use row date as context
                        dueDate = rowDate;

                        // Add one week for P&C activities (typical deadline)
                        const dueDateWithOffset = new Date(dueDate);
                        dueDateWithOffset.setDate(
                          dueDateWithOffset.getDate() + 7,
                        );
                        dueDate = dueDateWithOffset;
                      }

                      // Extract activity number if present
                      const pcMatch = cell.match(
                        /p&c\s*(?:activity)?\s*(\d+)/i,
                      );
                      if (pcMatch) {
                        title = `P&C Activity ${pcMatch[1]}`;
                      } else {
                        title = "P&C Activity";
                      }
                    } else if (/homework|hw/i.test(cell.toLowerCase())) {
                      type = "Homework";
                      dueDate = parseDate(cell, sheetYear);

                      // Extract HW number
                      const hwMatch = cell.match(/(?:homework|hw)\s*(\d+)/i);
                      if (hwMatch) {
                        title = `Homework ${hwMatch[1]}`;
                      } else {
                        title = "Homework";
                      }

                      // If no explicit date, use row date
                      if (!dueDate && rowDate) {
                        dueDate = rowDate;
                      }
                    } else if (/project/i.test(cell.toLowerCase())) {
                      type = "Project";
                      dueDate = parseDate(cell, sheetYear);

                      // Extract project number
                      const projectMatch = cell.match(/project\s*(\d+)/i);
                      if (projectMatch) {
                        title = `Project ${projectMatch[1]}`;
                      } else {
                        title = "Project";
                      }

                      // If no explicit date and we have a row date, projects typically due later
                      if (!dueDate && rowDate) {
                        const dueDateWithOffset = new Date(rowDate);
                        dueDateWithOffset.setDate(
                          dueDateWithOffset.getDate() + 14,
                        ); // Two weeks is typical
                        dueDate = dueDateWithOffset;
                      }
                    } else if (/midterm/i.test(cell.toLowerCase())) {
                      type = "Midterm Exam";
                      title = "Midterm Exam";
                      dueDate = parseDate(cell, sheetYear) || rowDate;
                    } else if (/final\s+exam/i.test(cell.toLowerCase())) {
                      type = "Final Exam";
                      title = "Final Exam";
                      dueDate = parseDate(cell, sheetYear) || rowDate;
                    } else if (/exam/i.test(cell.toLowerCase())) {
                      type = "Exam";
                      title = "Exam";
                      dueDate = parseDate(cell, sheetYear) || rowDate;
                    } else if (/quiz/i.test(cell.toLowerCase())) {
                      type = "Quiz";
                      dueDate = parseDate(cell, sheetYear) || rowDate;

                      const quizMatch = cell.match(/quiz\s*(\d+)/i);
                      if (quizMatch) {
                        title = `Quiz ${quizMatch[1]}`;
                      } else {
                        title = "Quiz";
                      }
                    } else {
                      // General assignment
                      dueDate = parseDate(cell, sheetYear);

                      // Try to extract date with "due by" pattern if parseDate failed
                      if (!dueDate) {
                        const dueDateMatch = cell.match(
                          /due\s+by\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,
                        );
                        if (dueDateMatch) {
                          const month = parseInt(dueDateMatch[1]);
                          const day = parseInt(dueDateMatch[2]);
                          let year = dueDateMatch[3]
                            ? parseInt(dueDateMatch[3])
                            : sheetYear || new Date().getFullYear();

                          // Handle 2-digit years
                          if (year < 100) {
                            year = year < 50 ? 2000 + year : 1900 + year;
                          }

                          dueDate = new Date(year, month - 1, day);

                          // Clean up title by removing the due date part
                          title = cell
                            .replace(
                              /due\s+by\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i,
                              "",
                            )
                            .trim();
                        }
                      }

                      // Still no date? Use row date if available
                      if (!dueDate && rowDate) {
                        dueDate = rowDate;
                      }
                    }

                    // Skip if no valid date, or if date is in the past
                    if (!dueDate || isDateInPast(dueDate)) {
                      continue;
                    }

                    // Format date properly using DateUtils
                    const formattedDate = formatDate(dueDate);

                    // Create a unique ID to prevent duplicates
                    const assignmentId = `${title.trim()}-${type}-${formattedDate}`;

                    if (!processedAssignments.has(assignmentId)) {
                      processedAssignments.add(assignmentId);

                      // Add to results
                      assignmentData.push({
                        title: title.trim(),
                        dueDate: formattedDate,
                        course: courseName,
                        description: description || "",
                        type: type,
                        fileName: file.name,
                      });
                    }
                  }
                }
              }
            }

            // Add all assignments from this file
            results.push(...assignmentData);
          } else if (fileType === "csv") {
            assignmentData = await processCSVFile(file);
            results.push(...assignmentData);
          }
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          setError(`Error processing ${file.name}: ${fileError.message}`);
        }
      }

      // Sort assignments by due date
      results.sort((a, b) => {
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);
        return dateA - dateB;
      });

      // Remove duplicates based on title, type, and due date
      const uniqueResults = [];
      const seen = new Set();

      for (const item of results) {
        const key = `${item.title}-${item.type}-${item.dueDate}-${item.course}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(item);
        }
      }

      console.log(`Found ${uniqueResults.length} unique assignments`);
      setExtractedData(uniqueResults);
    } catch (err) {
      console.error("Error processing files:", err);
      setError(`Failed to process files: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

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

          {showPowerPlannerExport && (
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
                  placeholder="e.g. CMP 158"
                  className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use original course names from the file
                </p>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handlePowerPlannerExport}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Export to Power Planner
                </button>

                <button
                  onClick={() => setShowPowerPlannerExport(false)}
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
          <li>
            Upload your syllabus or assignment files (Excel, CSV, PDF, or Word)
          </li>
          <li>Click &quot;Extract Assignments&quot; to process the files</li>
          <li>Review the extracted assignments in the table</li>
          <li>
            Choose your preferred export format (Power Planner, Calendar, or
            CSV)
          </li>
          <li>Click &quot;Export Data&quot; to download the file</li>
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
};

export default SyllabusSyncApp;
