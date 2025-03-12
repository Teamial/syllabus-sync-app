import React, { useState, useCallback } from "react";
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
import {
  parsePCActivityDueDate,
  parseHomeworkDueDate,
  parseExamDate,
  parseProjectDueDate,
  formatForPowerPlanner,
  generateCSV,
} from "./TimelineParser";

export default function SyllabusSyncApp() {
  // State management
  const [files, setFiles] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState("powerplanner");
  const [error, setError] = useState(null);
  const [showPowerPlannerOptions, setShowPowerPlannerOptions] = useState(false);
  const [courseOverride, setCourseOverride] = useState("");

  // Handle file upload
  const handleFilesUploaded = useCallback((newFiles) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    setError(null);
  }, []);

  // Handle file removal
  const handleRemoveFile = useCallback((index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  }, []);

  // Extract course code from filename
  const extractCourseCode = (fileName) => {
    // Regular expression to match common course code patterns (e.g., CS101, MATH 240)
    const courseMatch = fileName.match(/([A-Z]{2,4})\s*(\d{3,4})/i);
    if (courseMatch) {
      return `${courseMatch[1]} ${courseMatch[2]}`;
    }

    // If no match, return just the filename without extension
    return fileName.split(".")[0];
  };

  // Process Excel files
  const processExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
            cellStyles: true,
          });

          // Extract course name from filename
          const courseName = extractCourseCode(file.name);

          // Get current year for context
          const currentYear = new Date().getFullYear();

          // Extract semester if available
          let semester = "Spring";
          if (file.name.toLowerCase().includes("fall")) {
            semester = "Fall";
          } else if (file.name.toLowerCase().includes("summer")) {
            semester = "Summer";
          }

          // Process assignments from all sheets
          const assignments = [];

          for (const sheetName of workbook.SheetNames) {
            // Skip sheets that look like they contain metadata/info
            if (/info|metadata|readme|about/i.test(sheetName)) continue;

            // Extract year from sheet name if present
            const sheetYear =
              extractYearFromSheetName(sheetName) || currentYear;

            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Skip empty sheets
            if (!jsonData || jsonData.length < 2) continue;

            // Analyze sheet structure to identify date columns and assignment columns
            const columnMap = analyzeSheetStructure(jsonData);

            // Process rows to extract assignments
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;

              // Get row date
              let rowDate = null;
              if (columnMap.dateColumn !== -1 && row[columnMap.dateColumn]) {
                if (row[columnMap.dateColumn] instanceof Date) {
                  rowDate = row[columnMap.dateColumn];
                } else {
                  const dateValue = row[columnMap.dateColumn];
                  rowDate = parseDate(dateValue, sheetYear);
                }
              }

              // Skip rows without dates
              if (!rowDate) continue;

              // Skip dates in the past
              if (isDateInPast(rowDate)) continue;

              // Process homework assignments
              for (const col of columnMap.hwColumns) {
                if (row[col] && typeof row[col] === "string") {
                  const text = row[col];
                  if (/hw|homework/i.test(text)) {
                    const hwMatch = text.match(/(?:hw|homework)\s*(\d+)/i);
                    const hwNum = hwMatch ? hwMatch[1] : "";

                    // Get due date - either explicit or based on row date
                    const dueDate =
                      parseHomeworkDueDate(text, rowDate, sheetYear) || rowDate;

                    assignments.push({
                      title: `Homework ${hwNum}`,
                      dueDate: formatDate(dueDate),
                      course: courseName,
                      description:
                        getTopicText(row, columnMap) +
                        (text ? ` - ${text}` : ""),
                      type: "Homework",
                      fileName: file.name,
                    });
                  }
                }
              }

              // Process P&C Activities
              for (const col of columnMap.pcColumns) {
                if (row[col] && typeof row[col] === "string") {
                  const text = row[col];
                  if (/p&c|activity/i.test(text)) {
                    const activityMatch = text.match(
                      /(?:activity|p&c)\s*(\d+)/i,
                    );
                    const activityNum = activityMatch ? activityMatch[1] : "";

                    // Get due date
                    const dueDate =
                      parsePCActivityDueDate(text, rowDate, sheetYear) ||
                      rowDate;

                    assignments.push({
                      title: `P&C Activity ${activityNum}`,
                      dueDate: formatDate(dueDate),
                      course: courseName,
                      description:
                        getTopicText(row, columnMap) +
                        (text ? ` - ${text}` : ""),
                      type: "P&C Activity",
                      fileName: file.name,
                    });
                  }
                }
              }

              // Process Projects
              for (const col of columnMap.projectColumns) {
                if (row[col] && typeof row[col] === "string") {
                  const text = row[col];
                  if (/project/i.test(text)) {
                    const projectMatch = text.match(/project\s*(\d+)/i);
                    const projectNum = projectMatch ? projectMatch[1] : "";

                    // Get due date
                    const dueDate =
                      parseProjectDueDate(text, rowDate, sheetYear) || rowDate;

                    assignments.push({
                      title: `Project ${projectNum}`,
                      dueDate: formatDate(dueDate),
                      course: courseName,
                      description:
                        getTopicText(row, columnMap) +
                        (text ? ` - ${text}` : ""),
                      type: "Project",
                      fileName: file.name,
                    });
                  }
                }
              }

              // Process Exams
              for (const col of columnMap.examColumns) {
                if (row[col] && typeof row[col] === "string") {
                  const text = row[col];
                  if (/exam|midterm|final/i.test(text)) {
                    const examInfo = parseExamDate(text, rowDate, sheetYear);

                    if (examInfo) {
                      assignments.push({
                        title: examInfo.type,
                        dueDate: formatDate(examInfo.date),
                        course: courseName,
                        description:
                          getTopicText(row, columnMap) +
                          (text ? ` - ${text}` : ""),
                        type: examInfo.type,
                        fileName: file.name,
                      });
                    }
                  }
                }
              }

              // Also scan topic columns for embedded assignments
              for (const col of columnMap.topicColumns) {
                if (row[col] && typeof row[col] === "string") {
                  const text = row[col].toLowerCase();

                  // Look for embedded project references
                  if (
                    text.includes("project") &&
                    (text.includes("due") || text.includes("submit"))
                  ) {
                    const projectMatch = text.match(/project\s*(\d+)/i);
                    const projectNum = projectMatch ? projectMatch[1] : "";

                    assignments.push({
                      title: `Project ${projectNum}`,
                      dueDate: formatDate(rowDate),
                      course: courseName,
                      description: row[col],
                      type: "Project",
                      fileName: file.name,
                    });
                  }

                  // Look for embedded exam references
                  if (
                    (text.includes("midterm") || text.includes("final")) &&
                    text.includes("exam")
                  ) {
                    const examType = text.includes("midterm")
                      ? "Midterm Exam"
                      : "Final Exam";

                    assignments.push({
                      title: examType,
                      dueDate: formatDate(rowDate),
                      course: courseName,
                      description: row[col],
                      type: examType,
                      fileName: file.name,
                    });
                  }
                }
              }
            }
          }

          resolve(assignments);
        } catch (error) {
          console.error("Error processing Excel data:", error);
          reject(new Error(`Failed to process Excel file: ${error.message}`));
        }
      };

      reader.onerror = (error) => {
        reject(
          new Error(`FileReader error: ${error.message || "Unknown error"}`),
        );
      };

      reader.readAsArrayBuffer(file);
    });
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

  // Find value from multiple possible column names
  const findValueFromVariants = (row, variants) => {
    for (const variant of variants) {
      if (
        row[variant] !== undefined &&
        row[variant] !== null &&
        row[variant] !== ""
      ) {
        return row[variant];
      }
    }
    return null;
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
          `UID:${Math.random().toString(36).substring(2)}@syllabus-sync.app`,
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
  const handleExport = () => {
    if (extractedData.length === 0) return;

    try {
      if (exportFormat === "powerplanner") {
        setShowPowerPlannerOptions(true);
      } else if (exportFormat === "ics") {
        exportToICS();
      } else if (exportFormat === "csv") {
        exportToCSV();
      }
    } catch (err) {
      console.error("Export error:", err);
      setError(`Export failed: ${err.message}`);
    }
  };

  // Process all uploaded files
  const processFiles = async () => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setExtractedData([]);

    try {
      const allAssignments = [];

      for (const file of files) {
        try {
          const fileType = file.name.split(".").pop().toLowerCase();

          if (fileType === "xlsx" || fileType === "xls") {
            const excelAssignments = await processExcelFile(file);
            allAssignments.push(...excelAssignments);
          } else if (fileType === "csv") {
            const csvAssignments = await processCSVFile(file);
            allAssignments.push(...csvAssignments);
          } else {
            console.warn(`Unsupported file type: ${fileType}`);
          }
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          setError((prev) =>
            prev
              ? `${prev}\n${file.name}: ${fileError.message}`
              : `Error processing ${file.name}: ${fileError.message}`,
          );
        }
      }

      // Remove duplicates and sort by date
      const uniqueAssignments = removeDuplicateAssignments(allAssignments);
      uniqueAssignments.sort(
        (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
      );

      setExtractedData(uniqueAssignments);
    } catch (err) {
      console.error("Error processing files:", err);
      setError(`Failed to process files: ${err.message}`);
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
                  onClick={exportToPowerPlanner}
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
