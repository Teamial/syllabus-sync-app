import { parseDate, formatDate } from "./DateUtils";

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

  // If we have a row date, homework assignments are typically due within two weeks
  if (rowDate) {
    const dueDate = new Date(rowDate);
    dueDate.setDate(dueDate.getDate() + 14); // Add two weeks
    return dueDate;
  }

  return null;
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
  const dateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = parseInt(dateMatch[3]);
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
  } else if (rowDate) {
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
 * Format assignments for Power Planner CSV export
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
