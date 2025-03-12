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

    // Try to extract date from text patterns
    const dueDateMatch = dateString.match(
      /due\s+by\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,
    );
    if (dueDateMatch) {
      const month = parseInt(dueDateMatch[1]);
      const day = parseInt(dueDateMatch[2]);
      let year = dueDateMatch[3] ? parseInt(dueDateMatch[3]) : currentYear;

      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      return new Date(year, month - 1, day);
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

// Function to format date in display format
export function formatDisplayDate(dateStr) {
  try {
    if (!dateStr) return "";

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    // Get day name
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = dayNames[date.getDay()];

    // Format as "Tue, 3/11/2025"
    return `${dayName}, ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// Calculate days remaining until a date
export function getDaysRemaining(dateStr) {
  try {
    if (!dateStr) return null;

    const dueDate = new Date(dateStr);
    if (isNaN(dueDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (e) {
    return null;
  }
}

// Get text description for days remaining
export function getDaysRemainingText(dateStr) {
  const days = getDaysRemaining(dateStr);
  if (days === null) return "";

  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 0) return `Overdue by ${Math.abs(days)} days`;
  return `Due in ${days} days`;
}

// Get CSS class for days remaining
export function getDaysRemainingClass(dateStr) {
  const days = getDaysRemaining(dateStr);
  if (days === null) return "";

  if (days < 0) return "text-red-600 dark:text-red-400";
  if (days <= 1) return "text-orange-600 dark:text-orange-400";
  if (days <= 3) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}
