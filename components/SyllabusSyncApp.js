"use client";

import React, { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import FileUploader from "./FileUploader";
import AssignmentTable from "./AssignmentTable";
import ExportOptions from "./ExportOptions";

const SyllabusSyncApp = () => {
  const [files, setFiles] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState("powerplanner");
  const [error, setError] = useState(null);

  // Create refs to avoid the circular dependencies in useCallback
  const extractedDataRef = useRef([]);

  // Update ref when state changes
  React.useEffect(() => {
    extractedDataRef.current = extractedData;
  }, [extractedData]);

  // Helper functions
  const findValueByPossibleKeys = (obj, keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) {
        return obj[key];
      }
    }
    return null;
  };

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
        Class: item.course || "Unknown Course",
        DueDate: formatDateForPowerPlanner(item.dueDate || ""),
        Details: item.description || "",
        Type: item.type || "Assignment",
      }));

      // Convert to CSV
      const csv = Papa.unparse(powerPlannerFormat);
      downloadFile(csv, "power_planner_import.csv", "text/csv");
    } catch (err) {
      console.error("Error exporting to Power Planner:", err);
      setError(`Failed to export to Power Planner: ${err.message}`);
    }
  }, [downloadFile, formatDateForPowerPlanner]); // Include downloadFile in the dependency array

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
        exportToPowerPlanner();
      } else if (exportFormat === "ics") {
        exportToICS();
      } else if (exportFormat === "csv") {
        exportToCSV();
      }
    } catch (err) {
      console.error("Export error:", err);
      setError(`Failed to export data: ${err.message}`);
    }
  }, [exportFormat, exportToPowerPlanner, exportToICS, exportToCSV]);

  const processExcelFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided"));
        return;
      }

      try {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            if (!e.target || !e.target.result) {
              reject(new Error("Failed to read file"));
              return;
            }

            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {
              type: "array",
              cellDates: true, // Parse dates
            });

            // Debug workbook info
            console.log("Parsing Excel file:", file.name);
            console.log("Sheets:", workbook.SheetNames);

            // Get all sheets for processing
            const assignments = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to beginning of today

            // Common assignment types for detection
            const assignmentTypeKeywords = {
              homework: ["homework", "hw", "assignment", "problem set", "work"],
              quiz: ["quiz", "quizzes", "test", "assessment"],
              exam: ["exam", "midterm", "final", "final exam", "examination"],
              project: ["project", "paper", "report", "presentation", "lab"],
              reading: ["reading", "read", "chapter", "textbook", "book"],
              discussion: ["discussion", "forum", "participation", "discuss"],
              other: ["other", "misc", "miscellaneous"],
            };

            // Function to detect assignment type from text
            const detectAssignmentType = (text) => {
              if (!text) return "Assignment";
              const normalizedText = text.toString().toLowerCase();

              for (const [type, keywords] of Object.entries(
                assignmentTypeKeywords,
              )) {
                if (
                  keywords.some((keyword) => normalizedText.includes(keyword))
                ) {
                  return type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first letter
                }
              }
              return "Assignment"; // Default type
            };

            // Function to extract column names from the first row
            const extractColumnMappings = (worksheet) => {
              const range = XLSX.utils.decode_range(worksheet["!ref"]);
              const headerRow = {};

              // No columns or rows
              if (range.s.c > range.e.c || range.s.r > range.e.r) {
                return null;
              }

              // Extract header row
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({
                  r: range.s.r,
                  c: C,
                });
                const cell = worksheet[cellAddress];
                if (cell && cell.t) {
                  headerRow[C] = (cell.v || "").toString().trim().toLowerCase();
                }
              }

              // Determine column mappings
              const titleCols = [];
              const dateCols = [];
              const descCols = [];
              const typeCols = [];

              for (const [col, header] of Object.entries(headerRow)) {
                if (/assign|task|title|name|event/.test(header)) {
                  titleCols.push(parseInt(col));
                } else if (/due|deadline|date|when/.test(header)) {
                  dateCols.push(parseInt(col));
                } else if (/desc|detail|note|instruct/.test(header)) {
                  descCols.push(parseInt(col));
                } else if (/type|category|kind|class/.test(header)) {
                  typeCols.push(parseInt(col));
                }
              }

              return {
                titleCols,
                dateCols,
                descCols,
                typeCols,
                headerRow,
              };
            };

            // Process each sheet
            for (let i = 0; i < workbook.SheetNames.length; i++) {
              const sheetName = workbook.SheetNames[i];
              const worksheet = workbook.Sheets[sheetName];

              // Try to detect if this is a potential assignments sheet
              const sheetData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
              });

              // Skip empty sheets or those without enough data
              if (!sheetData || sheetData.length <= 1) continue;

              console.log(`Processing sheet: ${sheetName}`);

              // Extract column mappings from headers (if available)
              const columnMappings = extractColumnMappings(worksheet);
              console.log("Column mappings:", columnMappings);

              // First, try to convert with headers
              const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                raw: false,
              });

              // If we got data and have some headers mapped, process normally
              if (
                jsonData.length > 0 &&
                columnMappings &&
                (columnMappings.titleCols.length > 0 ||
                  columnMappings.dateCols.length > 0)
              ) {
                // Extract course name from file name or sheet name
                const courseName = extractCourseName(file.name) || sheetName;
                console.log(`Found assignments for course: ${courseName}`);

                // Process each row with better column detection
                const sheetAssignments = jsonData
                  .map((row, rowIndex) => {
                    try {
                      // Extract title using column mapping or fallback to findValueByPossibleKeys
                      let title = null;
                      if (columnMappings.titleCols.length > 0) {
                        // Try using mapped columns
                        for (const col of columnMappings.titleCols) {
                          const headerName = columnMappings.headerRow[col];
                          if (row[headerName]) {
                            title = row[headerName];
                            break;
                          }
                        }
                      }

                      // Fallback to general search
                      if (!title) {
                        title = findValueByPossibleKeys(row, [
                          "Assignment",
                          "Title",
                          "Task",
                          "Name",
                          "Assignment Name",
                          "Event",
                          "Assignment Title",
                          "Activity",
                        ]);
                      }

                      // If still no title, try to find any non-empty field that might be a title
                      if (!title) {
                        const possibleTitleFields = Object.entries(row).filter(
                          ([key, value]) =>
                            value &&
                            typeof value === "string" &&
                            value.length > 3 &&
                            !/due|date|deadline|percent|grade|points|score|desc|detail/.test(
                              key.toLowerCase(),
                            ),
                        );

                        if (possibleTitleFields.length > 0) {
                          title = possibleTitleFields[0][1];
                        }
                      }

                      // Default title if nothing found
                      if (!title) {
                        title = `Assignment ${rowIndex + 1}`;
                      }

                      // Extract due date
                      let dueDate = null;
                      let parsedDate = null;

                      // First try mapped date columns
                      if (columnMappings.dateCols.length > 0) {
                        for (const col of columnMappings.dateCols) {
                          const headerName = columnMappings.headerRow[col];
                          if (row[headerName]) {
                            dueDate = row[headerName];
                            break;
                          }
                        }
                      }

                      // Fallback to key search
                      if (!dueDate) {
                        dueDate = findValueByPossibleKeys(row, [
                          "Due",
                          "Due Date",
                          "Deadline",
                          "Date",
                          "Due date",
                          "DueDate",
                          "Due Date/Time",
                          "Due By",
                        ]);
                      }

                      // If we've found a due date, parse it correctly
                      if (dueDate) {
                        // Handle different date formats
                        if (dueDate instanceof Date) {
                          // Already a Date object
                          parsedDate = dueDate;
                        } else if (typeof dueDate === "number") {
                          // Excel date number (days since epoch)
                          // Excel's epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
                          // So we need to adjust the date when converting
                          const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
                          const millisecondsPerDay = 24 * 60 * 60 * 1000;
                          parsedDate = new Date(
                            excelEpoch.getTime() + dueDate * millisecondsPerDay,
                          );
                        } else if (typeof dueDate === "string") {
                          // Try to parse date strings
                          parsedDate = new Date(dueDate);

                          // Handle common formats that might fail
                          if (isNaN(parsedDate.getTime())) {
                            // Try MM/DD/YY format
                            const dateParts = dueDate.match(
                              /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
                            );
                            if (dateParts) {
                              const [_, month, day, year] = dateParts;
                              let fullYear = parseInt(year);

                              // Handle 2-digit years
                              if (fullYear < 100) {
                                fullYear += fullYear < 25 ? 2000 : 1900; // Assume 00-25 is 2000s, otherwise 1900s
                              }

                              parsedDate = new Date(
                                fullYear,
                                parseInt(month) - 1,
                                parseInt(day),
                              );
                            }
                          }
                        }

                        // If the year is way off (like 1900 or 2099), adjust to current year
                        if (parsedDate && !isNaN(parsedDate.getTime())) {
                          const currentYear = new Date().getFullYear();
                          if (
                            Math.abs(parsedDate.getFullYear() - currentYear) > 5
                          ) {
                            parsedDate.setFullYear(currentYear);
                          }

                          // Skip assignments due in the past
                          if (parsedDate < today) {
                            return null;
                          }
                        }
                      }

                      // Exit if no valid date (or create default for prototype)
                      if (!parsedDate || isNaN(parsedDate.getTime())) {
                        console.log(
                          `No valid date found for row ${rowIndex + 1}, skipping`,
                        );
                        return null;
                      }

                      // Format the date as MM/DD/YYYY
                      const formattedDate = `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;

                      // Extract description
                      let description = null;

                      if (columnMappings.descCols.length > 0) {
                        for (const col of columnMappings.descCols) {
                          const headerName = columnMappings.headerRow[col];
                          if (row[headerName]) {
                            description = row[headerName];
                            break;
                          }
                        }
                      }

                      if (!description) {
                        description =
                          findValueByPossibleKeys(row, [
                            "Description",
                            "Details",
                            "Notes",
                            "Instructions",
                            "Comments",
                            "Additional Information",
                          ]) || "";
                      }

                      // Extract or infer assignment type
                      let type = null;

                      if (columnMappings.typeCols.length > 0) {
                        for (const col of columnMappings.typeCols) {
                          const headerName = columnMappings.headerRow[col];
                          if (row[headerName]) {
                            type = row[headerName];
                            break;
                          }
                        }
                      }

                      if (!type) {
                        type = findValueByPossibleKeys(row, [
                          "Type",
                          "Category",
                          "Assignment Type",
                          "Classification",
                        ]);
                      }

                      // If type is still missing, try to infer from title or description
                      if (!type) {
                        type =
                          detectAssignmentType(title) ||
                          detectAssignmentType(description) ||
                          "Assignment";
                      }

                      console.log(
                        `Found assignment: ${title} due on ${formattedDate}`,
                      );

                      return {
                        title: String(title).trim(),
                        dueDate: formattedDate,
                        course: courseName,
                        description: description
                          ? String(description).trim()
                          : "",
                        type: String(type).trim(),
                        fileName: file.name,
                      };
                    } catch (rowError) {
                      console.error(
                        `Error processing row ${rowIndex}:`,
                        rowError,
                      );
                      return null;
                    }
                  })
                  .filter((item) => item !== null); // Remove null items

                if (sheetAssignments.length > 0) {
                  assignments.push(...sheetAssignments);
                  console.log(
                    `Added ${sheetAssignments.length} assignments from ${sheetName}`,
                  );
                }
              } else {
                console.log(
                  `Sheet ${sheetName} doesn't appear to contain assignments (no valid headers found)`,
                );
              }
            }

            console.log(`Total assignments extracted: ${assignments.length}`);
            resolve(assignments);
          } catch (error) {
            console.error("Error processing Excel data:", error);
            reject(new Error(`Failed to process Excel file: ${error.message}`));
          }
        };

        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(
            new Error(`FileReader error: ${error.message || "Unknown error"}`),
          );
        };

        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error in Excel processing setup:", error);
        reject(new Error(`Excel processing setup error: ${error.message}`));
      }
    });
  }, []);

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
              today.setHours(0, 0, 0, 0); // Set to beginning of today

              const assignments = results.data
                .filter(
                  (row) =>
                    row &&
                    typeof row === "object" &&
                    Object.keys(row).length > 0,
                ) // Skip empty rows
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
                .filter((item) => item !== null); // Remove null items (past assignments)

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

  const extractAssignmentsFromTimeline = useCallback(
    (sheetData, sheetName, sheetYear, courseName) => {
      const assignments = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // First, look for the header row to determine column structure
      let headerRowIndex = -1;
      let dueDateColumns = [];

      // Find the header row and identify columns with due date information
      for (let i = 0; i < Math.min(10, sheetData.length); i++) {
        const row = sheetData[i];
        if (!row) continue;

        // Check if this row contains due date column headers
        let dueDateFound = false;
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if (
            cell &&
            typeof cell === "string" &&
            /due\s+by|due\s+date/i.test(cell)
          ) {
            dueDateColumns.push(j);
            dueDateFound = true;
            headerRowIndex = i;
          }
        }

        if (dueDateFound) break;
      }

      // If no due date columns found, try to infer based on typical timeline structure
      if (dueDateColumns.length === 0) {
        // For typical timeline format, columns 10-12 often contain assignments
        dueDateColumns = [9, 10, 11];
      }

      // Process each row to find assignments
      for (
        let i = headerRowIndex > -1 ? headerRowIndex + 1 : 1;
        i < sheetData.length;
        i++
      ) {
        const row = sheetData[i];
        if (!row) continue;

        // Extract date from the row if available (for context)
        let rowDate = null;
        for (let j = 0; j < row.length; j++) {
          if (row[j] instanceof Date) {
            rowDate = row[j];
            break;
          }
        }

        // Get topic/description from the row
        let description = "";
        const topicColumns = [5, 7, 8]; // Common topic column indices
        for (const col of topicColumns) {
          if (row[col] && typeof row[col] === "string") {
            description = row[col];
            break;
          }
        }

        // Check each potential assignment column
        for (const colIndex of dueDateColumns) {
          if (!row[colIndex]) continue;

          const cell = row[colIndex];
          if (typeof cell !== "string") continue;

          // Check if this is an assignment cell
          if (/P&C|HW|Project|Assignment|Quiz|Exam|Midterm|Final/i.test(cell)) {
            // First try to extract explicit due date
            let dueDate = null;
            let title = cell;

            // Check for explicit due date pattern "Due by MM/DD"
            const dueDateMatch = cell.match(
              /[Dd]ue\s+[Bb]y\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
            );

            if (dueDateMatch) {
              let month = parseInt(dueDateMatch[1]);
              let day = parseInt(dueDateMatch[2]);
              let year = dueDateMatch[3]
                ? parseInt(dueDateMatch[3])
                : sheetYear;

              // If year is 2-digit, convert to 4-digit
              if (year < 100) {
                year = year < 50 ? 2000 + year : 1900 + year;
              }

              // Create a date object for the due date
              dueDate = new Date(year, month - 1, day);

              // Extract the title by removing the due date portion
              title = cell
                .replace(
                  /\s*[Dd]ue\s+[Bb]y\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/,
                  "",
                )
                .trim();
            } else if (rowDate) {
              // If no explicit due date but row has a date, use it as context
              // For assignments, typically the date in the row is not the due date
              // So we'll add some buffer time (1 week is common for assignments)
              dueDate = new Date(rowDate);
              dueDate.setDate(dueDate.getDate() + 7); // Add one week
            }

            // Skip past assignments if a valid date was found
            if (dueDate && dueDate < today) {
              continue;
            }

            // Determine assignment type
            let type = "Assignment";
            if (/P&C/i.test(cell)) type = "P&C Activity";
            else if (/HW|Homework/i.test(cell)) type = "Homework";
            else if (/Project/i.test(cell)) type = "Project";
            else if (/Quiz/i.test(cell)) type = "Quiz";
            else if (/Exam|Midterm|Final/i.test(cell)) type = "Exam";

            // Format the due date as string if available
            let formattedDate = "";
            if (dueDate && !isNaN(dueDate.getTime())) {
              formattedDate = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
            }

            // Add the assignment
            assignments.push({
              title: title,
              type: type,
              dueDate: formattedDate,
              course: courseName,
              description: description,
              fileName: `${courseName} (Timeline)`,
            });
          }
        }
      }

      return assignments;
    },
    [],
  );

  const processTimelineExcelFile = useCallback(
    (file) => {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error("No file provided"));
          return;
        }

        try {
          const reader = new FileReader();

          reader.onload = (e) => {
            try {
              if (!e.target || !e.target.result) {
                reject(new Error("Failed to read file"));
                return;
              }

              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, {
                type: "array",
                cellDates: true, // Parse dates
                cellStyles: true,
                cellFormulas: true,
                cellNF: true,
                sheetStubs: true,
              });

              console.log("Processing timeline Excel file:", file.name);
              console.log("Sheets:", workbook.SheetNames);

              // Extract course name from file name
              const courseCodeMatch = file.name.match(
                /([A-Z]{2,4})\s*(\d{3,4})/i,
              );
              let courseName = courseCodeMatch
                ? courseCodeMatch[0]
                : file.name.split(".")[0];

              // Process each sheet
              const allAssignments = [];

              for (const sheetName of workbook.SheetNames) {
                console.log(`Processing sheet: ${sheetName}`);

                // Try to extract year from sheet name
                let sheetYear = new Date().getFullYear();
                const yearMatch = sheetName.match(/(\d{4})_(Spring|Fall)/);
                if (yearMatch) {
                  sheetYear = parseInt(yearMatch[1]);
                  courseName = `${courseName} ${yearMatch[2]} ${sheetYear}`;
                }

                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Extract assignments based on the timeline format
                const sheetAssignments = extractAssignmentsFromTimeline(
                  jsonData,
                  sheetName,
                  sheetYear,
                  courseName,
                );

                if (sheetAssignments.length > 0) {
                  console.log(
                    `Found ${sheetAssignments.length} assignments in ${sheetName}`,
                  );
                  allAssignments.push(...sheetAssignments);
                }
              }

              console.log(
                `Total assignments extracted: ${allAssignments.length}`,
              );
              resolve(allAssignments);
            } catch (error) {
              console.error("Error processing Excel data:", error);
              reject(
                new Error(`Failed to process Excel file: ${error.message}`),
              );
            }
          };

          reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject(
              new Error(
                `FileReader error: ${error.message || "Unknown error"}`,
              ),
            );
          };

          reader.readAsArrayBuffer(file);
        } catch (error) {
          console.error("Error in Excel processing setup:", error);
          reject(new Error(`Excel processing setup error: ${error.message}`));
        }
      });
    },
    [extractAssignmentsFromTimeline],
  );

  const processFiles = useCallback(async () => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    const results = [];

    try {
      for (const file of files) {
        if (!file || !file.name) continue;

        try {
          const fileType = file.name.split(".").pop().toLowerCase();
          let assignmentData = []; // Changed from 'data' to 'assignmentData'

          if (fileType === "xlsx" || fileType === "xls") {
            // First, determine if this is a timeline-format Excel file
            const reader = new FileReader();
            const buffer = await new Promise((resolve, reject) => {
              reader.onload = (e) => resolve(e.target.result);
              reader.onerror = (e) => reject(e);
              reader.readAsArrayBuffer(file);
            });

            const fileData = new Uint8Array(buffer); // Changed from 'data' to 'fileData'
            const workbook = XLSX.read(fileData, {
              type: "array",
              cellDates: true,
              cellStyles: true,
              cellFormulas: true,
            });

            // Check for timeline format by looking at sheet names and structure
            const isTimelineFormat = workbook.SheetNames.some((name) =>
              name.match(/Timeline|Fall_|Spring_|Summer_|\d{4}/),
            );

            if (isTimelineFormat) {
              console.log(
                "Detected timeline format, using specialized processing",
              );
              assignmentData = await processTimelineExcelFile(file);
            } else {
              // Use the original Excel processing for standard formats
              assignmentData = await processExcelFile(file);
            }
          } else if (fileType === "csv") {
            assignmentData = await processCSVFile(file);
          } else if (fileType === "pdf") {
            // In a real implementation, this would use a PDF parsing library
            assignmentData = [
              {
                fileName: file.name,
                title: `${file.name} (PDF)`,
                course: extractCourseName(file.name),
                dueDate: "Not specified in PDF",
                type: "Unknown",
                description: "PDF parsing would be implemented here",
              },
            ];
          } else if (fileType === "docx" || fileType === "doc") {
            // In a real implementation, this would use a DOCX parsing library
            assignmentData = [
              {
                fileName: file.name,
                title: `${file.name} (Word Doc)`,
                course: extractCourseName(file.name),
                dueDate: "Not specified in document",
                type: "Unknown",
                description: "DOCX parsing would be implemented here",
              },
            ];
          }

          if (assignmentData && Array.isArray(assignmentData)) {
            results.push(...assignmentData);
          }
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          setError(`Error processing ${file.name}: ${fileError.message}`);
          // Continue processing other files
        }
      }

      setExtractedData(results);
    } catch (err) {
      console.error("Error processing files:", err);
      setError(`Failed to process files: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [
    files,
    processExcelFile,
    processCSVFile,
    processTimelineExcelFile,
    extractCourseName,
  ]);

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
