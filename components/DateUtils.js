// Parse a date string or value into a Date object
export function parseDate(dateValue, currentYear = new Date().getFullYear()) {
  if (!dateValue) return null;

  // If already a Date object
  if (dateValue instanceof Date) return dateValue;

  try {
    if (typeof dateValue === "number") {
      // Handle Excel date number (days since epoch)
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const millisecondsPerDay = 24 * 60 * 60 * 1000;
      return new Date(excelEpoch.getTime() + dateValue * millisecondsPerDay);
    }

    // Handle string date formats
    const dateString = String(dateValue).trim();

    // Direct parsing for standard format
    let parsedDate = new Date(dateString);

    // Check if the date is valid
    if (!isNaN(parsedDate.getTime())) {
      // Check if the year is reasonable
      if (Math.abs(parsedDate.getFullYear() - currentYear) > 5) {
        parsedDate.setFullYear(currentYear);
      }
      return parsedDate;
    }

    // Try MM/DD/YY format
    const dateParts = dateString.match(
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    );
    if (dateParts) {
      // Use array indices instead of destructuring with unused variable
      const month = dateParts[1];
      const day = dateParts[2];
      const year = dateParts[3];
      let fullYear = parseInt(year);

      // Handle 2-digit years
      if (fullYear < 100) {
        fullYear += fullYear < 50 ? 2000 : 1900;
      }

      return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    }

    return null;
  } catch (e) {
    console.error("Error parsing date:", e, dateValue);
    return null;
  }
}

// Format a date to MM/DD/YYYY
export function formatDate(date) {
  if (!date) return "";

  // If it's a string that's already formatted, just return it
  if (typeof date === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
    return date;
  }

  // Parse the date if it's not already a Date object
  const dateObj = date instanceof Date ? date : parseDate(date);

  if (!dateObj || isNaN(dateObj.getTime())) return "";

  return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
}

// Check if a date is in the past
export function isDateInPast(date) {
  if (!date) return false;

  const dateObj = date instanceof Date ? date : parseDate(date);
  if (!dateObj || isNaN(dateObj.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // consider these assignments due today as not in the past
  if (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  ) {
    return false;
  }

  return dateObj < today;
}

// Extract year from sheet name
export function extractYearFromSheetName(sheetName) {
  const yearMatch = sheetName.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
}

// Detect if Excel file has timeline format based on sheet names
export function isTimelineFormat(workbook) {
  return workbook.SheetNames.some((name) =>
    /timeline|fall_|spring_|summer_|\d{4}/i.test(name),
  );
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
