// components/TimelineParser.js - Fixed version

import * as XLSX from "xlsx";
import { parseDate, formatDate } from "./DateUtils";

/**
 * Parses an Excel sheet that has a timeline format like a course schedule
 * @param {Object} sheet - XLSX worksheet object
 * @param {Object} workbook - XLSX workbook object (for context)
 * @param {String} courseName - The name of the course
 * @param {Number} currentYear - The current year for context
 * @returns {Array} - Array of assignment objects
 */
export function parseTimelineSheet(sheet, workbook, courseName, currentYear) {
  // Defensive programming: check parameters
  if (!sheet) {
    console.warn("Invalid sheet passed to parseTimelineSheet");
    return [];
  }

  const assignments = [];

  try {
    // Convert sheet to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    // If no data, return empty array
    if (!jsonData || jsonData.length === 0) return assignments;

    // Analyze the structure to find column headers
    const columnMap = analyzeTimelineStructure(jsonData[0]);

    // Process each row
    jsonData.forEach((row) => {
      // Skip rows without dates
      if (!row[columnMap.dateColumn] && !row.Date) return;

      // Get the row date (try multiple possible date column names)
      const rowDate = parseDate(
        row[columnMap.dateColumn] || row.Date || row.date,
        currentYear,
      );

      // Skip invalid dates
      if (!rowDate) return;

      // Extract P&C Activities
      if (
        columnMap.pcColumn &&
        row[columnMap.pcColumn] &&
        typeof row[columnMap.pcColumn] === "string"
      ) {
        const pcActivity = extractPCActivity(
          row[columnMap.pcColumn],
          rowDate,
          courseName,
        );
        if (pcActivity) {
          assignments.push(pcActivity);
        }
      }

      // Extract Homework assignments
      if (
        columnMap.hwColumn &&
        row[columnMap.hwColumn] &&
        typeof row[columnMap.hwColumn] === "string"
      ) {
        const homework = extractHomework(
          row[columnMap.hwColumn],
          rowDate,
          courseName,
        );
        if (homework) {
          assignments.push(homework);
        }
      }

      // Look for exams in lecture topics
      if (
        columnMap.topicColumn &&
        row[columnMap.topicColumn] &&
        typeof row[columnMap.topicColumn] === "string" &&
        row[columnMap.topicColumn].toLowerCase().includes("exam")
      ) {
        const exam = extractExam(
          row[columnMap.topicColumn],
          rowDate,
          courseName,
        );
        if (exam) {
          assignments.push(exam);
        }
      }

      // Look for projects in lab session topics
      if (
        columnMap.labColumn &&
        row[columnMap.labColumn] &&
        typeof row[columnMap.labColumn] === "string" &&
        row[columnMap.labColumn].toLowerCase().includes("project")
      ) {
        const project = extractProject(
          row[columnMap.labColumn],
          rowDate,
          courseName,
        );
        if (project) {
          assignments.push(project);
        }
      }
    });

    return assignments;
  } catch (error) {
    console.error("Error parsing timeline sheet:", error);
    return [];
  }
}

/**
 * Analyzes the timeline structure to identify important columns
 */
function analyzeTimelineStructure(headerRow) {
  if (!headerRow)
    return {
      dateColumn: null,
      pcColumn: null,
      hwColumn: null,
      topicColumn: null,
      labColumn: null,
    };

  const columnMap = {
    dateColumn: null,
    pcColumn: null,
    hwColumn: null,
    topicColumn: null,
    labColumn: null,
  };

  // Go through all properties in the header row
  Object.keys(headerRow).forEach((key) => {
    const lowerKey = key.toLowerCase();

    if (lowerKey === "date") {
      columnMap.dateColumn = key;
    } else if (
      lowerKey.includes("p&c") ||
      lowerKey.includes("p & c") ||
      lowerKey.includes("activity")
    ) {
      columnMap.pcColumn = key;
    } else if (lowerKey.includes("hw") || lowerKey.includes("homework")) {
      columnMap.hwColumn = key;
    } else if (lowerKey.includes("lecture") || lowerKey.includes("topic")) {
      columnMap.topicColumn = key;
    } else if (lowerKey.includes("lab")) {
      columnMap.labColumn = key;
    }
  });

  return columnMap;
}

/**
 * Extract P&C activity from cell text
 */
function extractPCActivity(cellText, rowDate, courseName) {
  if (!cellText || !rowDate) return null;

  // Skip empty activities
  if (cellText === "-" || cellText.trim() === "") return null;

  // Extract activity number
  const activityMatch = cellText.match(/(?:P&C|Activity)\s*(\d+)/i);
  const activityNum = activityMatch ? activityMatch[1] : "";

  // Find specific date if mentioned
  const dueDateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  let dueDate = rowDate;

  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3]
      ? parseInt(dueDateMatch[3])
      : rowDate.getFullYear();

    dueDate = new Date(year, month - 1, day);
  }

  return {
    title: `P&C Activity ${activityNum}`,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: cellText,
    type: "P&C Activity",
  };
}

/**
 * Extract homework from cell text
 */
function extractHomework(cellText, rowDate, courseName) {
  if (!cellText || !rowDate) return null;

  // Skip empty assignments
  if (cellText === "-" || cellText.trim() === "") return null;

  // Extract homework number
  const hwMatch = cellText.match(/(?:HW|Homework)\s*(\d+)/i);
  const hwNum = hwMatch ? hwMatch[1] : "";

  // Find specific date if mentioned
  const dueDateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  let dueDate = rowDate;

  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3]
      ? parseInt(dueDateMatch[3])
      : rowDate.getFullYear();

    dueDate = new Date(year, month - 1, day);
  }

  return {
    title: `Homework ${hwNum}`,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: cellText,
    type: "Homework",
  };
}

/**
 * Extract exam from cell text
 */
function extractExam(cellText, rowDate, courseName) {
  if (!cellText || !rowDate) return null;

  // Skip if not exam related
  if (
    !cellText.toLowerCase().includes("exam") &&
    !cellText.toLowerCase().includes("midterm") &&
    !cellText.toLowerCase().includes("final")
  ) {
    return null;
  }

  let examType = "Exam";
  if (cellText.toLowerCase().includes("midterm")) {
    examType = "Midterm Exam";
  } else if (cellText.toLowerCase().includes("final")) {
    examType = "Final Exam";
  }

  return {
    title: examType,
    dueDate: formatDate(rowDate),
    course: courseName,
    description: cellText,
    type: examType,
  };
}

/**
 * Extract project from cell text
 */
function extractProject(cellText, rowDate, courseName) {
  if (!cellText || !rowDate) return null;

  // Skip if not project related
  if (!cellText.toLowerCase().includes("project")) {
    return null;
  }

  // Extract project number
  const projectMatch = cellText.match(/PROJECT\s*(\d+)/i);
  const projectNum = projectMatch ? projectMatch[1] : "";

  return {
    title: `Project ${projectNum}`,
    dueDate: formatDate(rowDate),
    course: courseName,
    description: cellText,
    type: "Project",
  };
}

/**
 * Detect if the workbook contains a timeline format
 */
export function detectTimelineFormat(workbook) {
  if (!workbook || !workbook.SheetNames || !workbook.Sheets) {
    return false;
  }

  let hasTimelineFormat = false;

  try {
    // Check each sheet
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Skip empty sheets
      if (!jsonData || jsonData.length < 2) return;

      const headerRow = jsonData[0];
      if (!headerRow) return;

      // Convert header row to string for pattern matching
      const headerText = headerRow.join(" ").toLowerCase();

      // Check for patterns found in timeline sheets
      if (
        headerText.includes("week") &&
        headerText.includes("date") &&
        (headerText.includes("lecture") || headerText.includes("lab"))
      ) {
        hasTimelineFormat = true;
      }
    });
  } catch (error) {
    console.warn("Error detecting timeline format:", error);
    return false;
  }

  return hasTimelineFormat;
}
