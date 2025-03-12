import { parseDate, isDateInPast } from "./DateUtils";

// Add this function at the top of your TimelineParser.js file
function parseFilePath(filePath) {
  // Extract filename from path
  const fileName = filePath.split("/").pop().split("\\").pop();

  // Extract extension
  const extIndex = fileName.lastIndexOf(".");
  const ext = extIndex > -1 ? fileName.slice(extIndex + 1) : "";

  // Extract name without extension
  const name = extIndex > -1 ? fileName.slice(0, extIndex) : fileName;

  // Extract directory
  const dir = filePath.substring(0, filePath.length - fileName.length) || "./";

  return {
    base: fileName,
    name: name,
    ext: ext ? `.${ext}` : "",
    dir: dir,
  };
}

/**
 * Parse P&C Activity due dates using multiple strategies
 */
export function parsePCActivityDueDate(cellText, rowDate, sheetYear) {
  if (!cellText) return null;

  // Check for explicit due date in the cell "Due by MM/DD"
  const dueDateMatch = cellText.match(
    /due\s+by\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,
  );
  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3] ? parseInt(dueDateMatch[3]) : sheetYear;

    // Handle 2-digit years
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month - 1, day);
  }

  // If we have a row date, P&C activities are typically due within a week
  if (rowDate) {
    const dueDate = new Date(rowDate);
    dueDate.setDate(dueDate.getDate() + 7); // Add one week
    return dueDate;
  }

  return null;
}

/**
 * Parse Homework assignment due dates
 */
export function parseHomeworkDueDate(cellText, rowDate, sheetYear) {
  if (!cellText) return null;

  // Check for explicit due date in the cell "Due by MM/DD"
  const dueDateMatch = cellText.match(
    /due\s+by\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,
  );
  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3] ? parseInt(dueDateMatch[3]) : sheetYear;

    // Handle 2-digit years
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month - 1, day);
  }

  const simpleDateMatch = cellText.match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
  );
  if (simpleDateMatch) {
    const month = parseInt(simpleDateMatch[1]);
    const day = parseInt(simpleDateMatch[2]);
    let year = simpleDateMatch[3] ? parseInt(simpleDateMatch[3]) : sheetYear;

    // Handle 2-digit years
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month - 1, day);
  }

  const currentDate = new Date();

  if (rowDate && rowDate <= currentDate) {
    return currentDate;
  }

  // If we have a row date, homework assignments are typically due within two weeks
  if (rowDate) {
    const dueDate = new Date(rowDate);
    dueDate.setDate(dueDate.getDate() + 7); // One week after class
    return dueDate;
  }

  return null;
}

/**
 * Parse exam (midterm/final) dates
 */
export function parseExamDate(cellText, rowDate, sheetYear) {
  if (!cellText) return null;

  // Skip cells that are just about review or exam setup
  if (/review|buffer|opens/i.test(cellText) && !/due|closes/i.test(cellText)) {
    return null;
  }

  let examType = "Exam";
  if (/midterm/i.test(cellText)) {
    examType = "Midterm Exam";
  } else if (/final/i.test(cellText)) {
    examType = "Final Exam";
  } else if (!/exam/i.test(cellText)) {
    return null; // Not an exam at all
  }

  // Try to extract explicit date
  const dateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  let dueDate = null;

  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    let year = dateMatch[3] ? parseInt(dateMatch[3]) : sheetYear;

    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    dueDate = new Date(year, month - 1, day);
  }
  // If no explicit date but we have a row date
  else if (rowDate) {
    dueDate = new Date(rowDate);
  }

  if (!dueDate || isNaN(dueDate.getTime())) {
    return null;
  }

  return {
    date: dueDate,
    type: examType,
  };
}

/**
 * Parse project due dates
 */
export function parseProjectDueDate(cellText, rowDate, sheetYear) {
  if (!cellText) return null;

  if (!/project/i.test(cellText)) {
    return null; // Not a project cell
  }

  // Format 1: Date in MM/DD/YYYY format
  const dateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = parseInt(
      dateMatch[3] ? parseFilePath(dateMatch[3]) : sheetYear,
    );
    return new Date(year, month - 1, day);
  }

  // Format 2: Weekday with date
  const weekdayMatch = cellText.match(
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i,
  );
  if (weekdayMatch) {
    const month = parseInt(weekdayMatch[1]);
    const day = parseInt(weekdayMatch[2]);
    let year = weekdayMatch[3] ? parseInt(weekdayMatch[3]) : sheetYear;

    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month - 1, day);
  }

  // If project contains "DUE" and we have a row date
  if (/due/i.test(cellText) && rowDate) {
    // Projects typically due 2-3 weeks after they're assigned
    const dueDate = new Date(rowDate);
    dueDate.setDate(dueDate.getDate() + 21); // 3 weeks after row date
    return dueDate;
  }

  if (rowDate) {
    return new Date(rowDate);
  }

  return null;
}

/**
 * Enhanced Timeline Excel processor
 * Specializes in extracting assignments from timeline format Excel files
 */
import * as XLSX from "xlsx";

/**
 * Enhanced Timeline Excel parser that correctly handles complex course schedule formats
 * @param {File} file - The Excel file to process
 * @param {boolean} verbose - Whether to log detailed processing information
 * @returns {Promise<Array>} - Array of extracted assignments
 */
export function processTimelineExcelFile(file, verbose = false) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"));
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
            cellStyles: true,
          });

          if (verbose)
            console.log(`Processing timeline Excel file: ${file.name}`);

          // Extract course code from filename
          const courseCodeMatch = file.name.match(/([A-Z]{2,4})[\d_]/i);
          let courseCode = courseCodeMatch ? courseCodeMatch[1] : "";

          // Add course number if present
          const courseNumberMatch = file.name.match(/([A-Z]{2,4})(\d+)/i);
          if (courseNumberMatch) {
            courseCode = courseNumberMatch[1] + " " + courseNumberMatch[2];
          }

          // Determine current year and semester from sheet names or file name
          let currentYear = new Date().getFullYear();
          let semester = "Spring";

          // Check sheet names for year and semester info
          for (const sheetName of workbook.SheetNames) {
            const yearMatch = sheetName.match(/(\d{4})_(Spring|Fall|Summer)/i);
            if (yearMatch) {
              currentYear = parseInt(yearMatch[1]);
              semester = yearMatch[2];
              break;
            }
          }

          // Also check filename for year
          const fileYearMatch = file.name.match(/(\d{4})/);
          if (fileYearMatch) {
            currentYear = parseInt(fileYearMatch[1]);
          }

          // Course name with semester and year
          const courseName = `${courseCode} ${semester} ${currentYear}`;

          // Process each sheet
          const allAssignments = [];

          for (const sheetName of workbook.SheetNames) {
            if (verbose) console.log(`Processing sheet: ${sheetName}`);

            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Skip empty sheets
            if (!jsonData || jsonData.length < 2) continue;

            // Analyze sheet structure to identify important columns
            const columnMap = analyzeSheetStructure(jsonData);
            if (verbose) console.log("Column map:", columnMap);

            // Process the rows with the identified column structure
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || !Array.isArray(row) || row.length === 0) continue;

              // Get the date for this row
              const rowDate = extractRowDate(row, columnMap.dateColumn);
              if (!rowDate) continue;

              // Extract all assignment types from this row
              extractAssignments(
                row,
                rowDate,
                columnMap,
                courseName,
                allAssignments,
              );
            }
          }

          // Remove duplicates and sort by date
          const uniqueAssignments = removeDuplicateAssignments(allAssignments);
          uniqueAssignments.sort(
            (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
          );

          if (verbose)
            console.log(`Found ${uniqueAssignments.length} assignments`);
          resolve(uniqueAssignments);
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
}

/**
 * Analyze the sheet structure to identify important columns
 * @param {Array} jsonData - The sheet data as a 2D array
 * @returns {Object} - Map of column indices for different assignment types
 */
function analyzeSheetStructure(jsonData) {
  const columnMap = {
    dateColumn: -1,
    lectureColumn: -1,
    labColumn: -1,
    hwDueColumns: [],
    pcDueColumns: [],
    projectColumns: [],
    examColumns: [],
    topicColumns: [],
  };

  // Look for header row (usually row 0)
  const headerRow = jsonData[0];
  if (!headerRow) return columnMap;

  // Scan through header row to identify column types
  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i]?.toString().toLowerCase() || "";

    if (header.includes("date")) {
      columnMap.dateColumn = i;
    } else if (header.includes("lec") && header.includes("#")) {
      columnMap.lectureColumn = i;
    } else if (header.includes("lab") && header.includes("#")) {
      columnMap.labColumn = i;
    } else if (header.includes("hw") && header.includes("due")) {
      columnMap.hwDueColumns.push(i);
    } else if (header.includes("p&c") && header.includes("due")) {
      columnMap.pcDueColumns.push(i);
    } else if (header.includes("project")) {
      columnMap.projectColumns.push(i);
    } else if (
      header.includes("exam") ||
      header.includes("midterm") ||
      header.includes("final")
    ) {
      columnMap.examColumns.push(i);
    } else if (header.includes("topic")) {
      columnMap.topicColumns.push(i);
    }
  }

  // If no date column found, use column 1 as a fallback (common in timeline spreadsheets)
  if (columnMap.dateColumn === -1) {
    columnMap.dateColumn = 1;
  }

  // Second pass through rows 1-5 to look for assignment columns if none were found
  if (
    columnMap.hwDueColumns.length === 0 ||
    columnMap.pcDueColumns.length === 0
  ) {
    for (let rowIdx = 1; rowIdx < Math.min(5, jsonData.length); rowIdx++) {
      const row = jsonData[rowIdx];
      if (!row) continue;

      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = row[colIdx]?.toString().toLowerCase() || "";

        if (
          (cell.includes("hw") || cell.includes("homework")) &&
          columnMap.hwDueColumns.indexOf(colIdx) === -1
        ) {
          columnMap.hwDueColumns.push(colIdx);
        } else if (
          cell.includes("p&c") &&
          columnMap.pcDueColumns.indexOf(colIdx) === -1
        ) {
          columnMap.pcDueColumns.push(colIdx);
        } else if (
          (cell.includes("project") || cell.includes("proj")) &&
          columnMap.projectColumns.indexOf(colIdx) === -1
        ) {
          columnMap.projectColumns.push(colIdx);
        } else if (
          (cell.includes("exam") ||
            cell.includes("midterm") ||
            cell.includes("final")) &&
          columnMap.examColumns.indexOf(colIdx) === -1
        ) {
          columnMap.examColumns.push(colIdx);
        }
      }
    }
  }

  return columnMap;
}

/**
 * Extract date from row
 * @param {Array} row - The row data
 * @param {number} dateColumn - Index of date column
 * @returns {Date|null} - The extracted date or null
 */
function extractRowDate(row, dateColumn) {
  if (dateColumn === -1 || !row[dateColumn]) return null;

  const dateValue = row[dateColumn];

  // If already a Date object
  if (dateValue instanceof Date) return dateValue;

  // Try to parse string date
  try {
    // Handle MM/DD/YYYY format
    if (typeof dateValue === "string") {
      const dateParts = dateValue.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateParts) {
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        const year = parseInt(dateParts[3]);
        return new Date(year, month, day);
      }
    }

    // General date parsing
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  } catch (e) {
    console.warn("Error parsing date:", e);
  }

  return null;
}

/**
 * Extract all types of assignments from a row
 * @param {Array} row - The row data
 * @param {Date} rowDate - The date for this row
 * @param {Object} columnMap - Map of column indices
 * @param {string} courseName - The course name
 * @param {Array} allAssignments - Array to add assignments to
 */
function extractAssignments(
  row,
  rowDate,
  columnMap,
  courseName,
  allAssignments,
) {
  // Check for P&C Activities
  for (const colIdx of columnMap.pcDueColumns) {
    const cell = row[colIdx];
    if (!cell) continue;

    const cellText = cell.toString();
    if (cellText.includes("P&C") || cellText.includes("Activity")) {
      // Extract activity number
      const activityMatch = cellText.match(/Activity\s*(\d+)/i);
      const activityNum = activityMatch ? activityMatch[1] : "";

      let title = `P&C Activity ${activityNum}`;
      let description = cellText;
      let dueDate = rowDate;

      // Get topic if available
      const topicText = getTopicFromRow(row, columnMap.topicColumns);
      if (topicText) {
        description = `${topicText} - ${description}`;
      }

      allAssignments.push({
        title,
        dueDate: formatDate(dueDate),
        course: courseName,
        description,
        type: "P&C Activity",
      });
    }
  }

  // Check for Homework
  for (const colIdx of columnMap.hwDueColumns) {
    const cell = row[colIdx];
    if (!cell) continue;

    const cellText = cell.toString();
    if (cellText.includes("HW") || cellText.includes("Homework")) {
      // Extract HW number
      const hwMatch = cellText.match(/HW\s*(\d+)/i);
      const hwNum = hwMatch ? hwMatch[1] : "";

      let title = `HW ${hwNum}`;
      let description = cellText;
      let dueDate = rowDate;

      // Get topic if available
      const topicText = getTopicFromRow(row, columnMap.topicColumns);
      if (topicText) {
        description = `${topicText} - ${description}`;
      }

      allAssignments.push({
        title,
        dueDate: formatDate(dueDate),
        course: courseName,
        description,
        type: "Homework",
      });
    }
  }

  // Check for Projects
  for (const colIdx of columnMap.projectColumns) {
    const cell = row[colIdx];
    if (!cell) continue;

    const cellText = cell.toString();
    if (cellText.includes("PROJECT") || cellText.includes("Project")) {
      // Extract Project number
      const projectMatch = cellText.match(/Project\s*(\d+)/i);
      const projectNum = projectMatch ? projectMatch[1] : "";

      let title = `Project ${projectNum}`;
      let description = cellText;
      let dueDate = rowDate;

      // Get topic if available
      const topicText = getTopicFromRow(row, columnMap.topicColumns);
      if (topicText) {
        description = `${topicText} - ${description}`;
      }

      allAssignments.push({
        title,
        dueDate: formatDate(dueDate),
        course: courseName,
        description,
        type: "Project",
      });
    }
  }

  // Check for Exams
  for (const colIdx of columnMap.examColumns) {
    const cell = row[colIdx];
    if (!cell) continue;

    const cellText = cell.toString().toLowerCase();
    if (
      cellText.includes("exam") ||
      cellText.includes("midterm") ||
      cellText.includes("final")
    ) {
      let title = "Exam";
      let type = "Exam";

      if (cellText.includes("midterm")) {
        title = "Midterm Exam";
        type = "Midterm";
      } else if (cellText.includes("final")) {
        title = "Final Exam";
        type = "Final Exam";
      }

      allAssignments.push({
        title,
        dueDate: formatDate(rowDate),
        course: courseName,
        description: cellText,
        type,
      });
    }
  }

  // Also scan lecture/topic columns for assignments that might be embedded there
  scanForEmbeddedAssignments(
    row,
    rowDate,
    columnMap,
    courseName,
    allAssignments,
  );
}

/**
 * Scan lecture and topic columns for embedded assignment information
 * @param {Array} row - The row data
 * @param {Date} rowDate - The date for this row
 * @param {Object} columnMap - Map of column indices
 * @param {string} courseName - The course name
 * @param {Array} allAssignments - Array to add assignments to
 */
function scanForEmbeddedAssignments(
  row,
  rowDate,
  columnMap,
  courseName,
  allAssignments,
) {
  // Check lecture column
  if (columnMap.lectureColumn !== -1 && row[columnMap.lectureColumn]) {
    const cellText = row[columnMap.lectureColumn].toString().toLowerCase();

    // Look for assignment keywords
    if (cellText.includes("hw") || cellText.includes("homework")) {
      extractEmbeddedHomework(cellText, rowDate, courseName, allAssignments);
    }

    if (cellText.includes("p&c") || cellText.includes("activity")) {
      extractEmbeddedPCActivity(cellText, rowDate, courseName, allAssignments);
    }

    if (cellText.includes("project")) {
      extractEmbeddedProject(cellText, rowDate, courseName, allAssignments);
    }

    if (
      cellText.includes("exam") ||
      cellText.includes("midterm") ||
      cellText.includes("final")
    ) {
      extractEmbeddedExam(cellText, rowDate, courseName, allAssignments);
    }
  }

  // Also check topic columns
  for (const colIdx of columnMap.topicColumns) {
    if (!row[colIdx]) continue;

    const cellText = row[colIdx].toString().toLowerCase();

    // Look for assignment keywords
    if (cellText.includes("hw") || cellText.includes("homework")) {
      extractEmbeddedHomework(cellText, rowDate, courseName, allAssignments);
    }

    if (cellText.includes("p&c") || cellText.includes("activity")) {
      extractEmbeddedPCActivity(cellText, rowDate, courseName, allAssignments);
    }

    if (cellText.includes("project")) {
      extractEmbeddedProject(cellText, rowDate, courseName, allAssignments);
    }

    if (
      cellText.includes("exam") ||
      cellText.includes("midterm") ||
      cellText.includes("final")
    ) {
      extractEmbeddedExam(cellText, rowDate, courseName, allAssignments);
    }
  }
}

/**
 * Extract embedded homework from text
 */
function extractEmbeddedHomework(text, date, courseName, allAssignments) {
  const hwMatch = text.match(/hw\s*(\d+)/i);
  if (!hwMatch) return;

  const hwNum = hwMatch[1];

  // Add one week to date for typical homework due date
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + 7);

  allAssignments.push({
    title: `HW ${hwNum}`,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: text,
    type: "Homework",
  });
}

/**
 * Extract embedded P&C activity from text
 */
function extractEmbeddedPCActivity(text, date, courseName, allAssignments) {
  const activityMatch = text.match(/p&c\s*(?:activity)?\s*(\d+)/i);
  if (!activityMatch) return;

  const activityNum = activityMatch[1];

  // Add one week to date for typical P&C activity due date
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + 7);

  allAssignments.push({
    title: `P&C Activity ${activityNum}`,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: text,
    type: "P&C Activity",
  });
}

/**
 * Extract embedded project from text
 */
function extractEmbeddedProject(text, date, courseName, allAssignments) {
  const projectMatch = text.match(/project\s*(\d+)/i);
  if (!projectMatch) return;

  const projectNum = projectMatch[1];

  // Add three weeks to date for typical project due date
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + 21);

  allAssignments.push({
    title: `Project ${projectNum}`,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: text,
    type: "Project",
  });
}

/**
 * Extract embedded exam from text
 */
function extractEmbeddedExam(text, date, courseName, allAssignments) {
  let title = "Exam";
  let type = "Exam";

  if (text.includes("midterm")) {
    title = "Midterm Exam";
    type = "Midterm";
  } else if (text.includes("final")) {
    title = "Final Exam";
    type = "Final Exam";
  }

  allAssignments.push({
    title,
    dueDate: formatDate(date),
    course: courseName,
    description: text,
    type,
  });
}

/**
 * Get topic information from row
 * @param {Array} row - The row data
 * @param {Array} topicColumns - Array of topic column indices
 * @returns {string} - Combined topic text
 */
function getTopicFromRow(row, topicColumns) {
  let topicText = "";

  for (const colIdx of topicColumns) {
    if (row[colIdx]) {
      if (topicText) topicText += " - ";
      topicText += row[colIdx].toString();
    }
  }

  return topicText;
}

/**
 * Format date to MM/DD/YYYY
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date) return "";

  // If it's already a string in MM/DD/YYYY format, return it
  if (typeof date === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
    return date;
  }

  try {
    // Make sure it's a Date object
    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj.getTime())) return "";

    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
  } catch (e) {
    console.error("Error formatting date:", e);
    return "";
  }
}

/**
 * Remove duplicate assignments based on title and due date
 * @param {Array} assignments - Array of assignments
 * @returns {Array} - Array with duplicates removed
 */
function removeDuplicateAssignments(assignments) {
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
}

/**
 * Power Planner Format Utility
 *
 * This module formats assignment data for Power Planner import
 */

/**
 * Format assignments for Power Planner CSV export
 * @param {Array} assignments - Array of assignment objects
 * @param {string} courseOverride - Optional course name override
 * @returns {Array} Formatted assignments ready for CSV export
 */
export function formatForPowerPlanner(assignments, courseOverride = "") {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }

  return assignments.map((item) => {
    // Apply course override if provided
    const course = courseOverride
      ? courseOverride
      : item.course || "Unknown Course";

    return {
      Name: item.title || "Unnamed Assignment",
      Class: course,
      DueDate: formatDateForPowerPlanner(item.dueDate || ""),
      Details: formatDetails(item),
      Type: mapAssignmentType(item.type) || "Assignment",
    };
  });
}

/**
 * Format date for Power Planner (MM/DD/YYYY)
 * @param {string|Date} dateValue - The date to format
 * @returns {string} - Formatted date string
 */
function formatDateForPowerPlanner(dateValue) {
  if (!dateValue) return "";

  try {
    // If it's already a string in MM/DD/YYYY format
    if (
      typeof dateValue === "string" &&
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)
    ) {
      return dateValue;
    }

    // Convert to Date object
    const date =
      typeof dateValue === "string" ? new Date(dateValue) : dateValue;

    if (isNaN(date.getTime())) return "";

    // Format as MM/DD/YYYY which Power Planner expects
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } catch (e) {
    console.error("Error formatting date for Power Planner:", e);
    return "";
  }
}

/**
 * Format the details field for Power Planner
 * @param {Object} item - Assignment object
 * @returns {string} - Formatted details
 */
function formatDetails(item) {
  const details = [];

  if (item.description) {
    details.push(item.description);
  }

  // Include the source file
  if (item.fileName) {
    details.push(`Source: ${item.fileName}`);
  }

  return details.join("\n");
}

/**
 * Map internal assignment types to Power Planner compatible types
 * @param {string} type - Internal assignment type
 * @returns {string} - Power Planner compatible type
 */
function mapAssignmentType(type) {
  if (!type) return "Assignment";

  // Power Planner supports these assignment types:
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

  // Return mapped type or default to original type
  return typeMap[type] || type;
}

/**
 * Generate CSV content from formatted assignments
 * @param {Array} formattedAssignments - Array of formatted assignments
 * @returns {string} - CSV content
 */
export function generateCSV(formattedAssignments) {
  if (!formattedAssignments || formattedAssignments.length === 0) {
    return "";
  }

  // Header row with field names
  const header = Object.keys(formattedAssignments[0]).join(",");

  // Data rows
  const rows = formattedAssignments.map((item) => {
    return Object.values(item)
      .map((value) => {
        // Properly escape values containing commas or quotes
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",");
  });

  // Combine header and rows
  return [header, ...rows].join("\n");
}
