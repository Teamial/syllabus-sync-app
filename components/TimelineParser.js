import { parseDate, formatDate, isDateInPast } from "./DateUtils";

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
    dueDate.setDate(dueDate.getDate() + 14); // Two weeks after class
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
 * Enhanced Timeline Excel processor
 * Specializes in extracting assignments from timeline format Excel files
 */
export function processTimelineExcelFile(file, XLSX, verbose = false) {
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
            cellDates: true,
            cellStyles: true,
            cellFormulas: true,
            cellNF: true,
            sheetStubs: true,
          });

          if (verbose)
            console.log("Processing timeline Excel file:", file.name);
          if (verbose) console.log("Available sheets:", workbook.SheetNames);

          // Extract course name from file name
          const courseCodeMatch = file.name.match(/([A-Z]{2,4})\s*(\d{3,4})/i);
          let courseCode = courseCodeMatch
            ? courseCodeMatch[0]
            : file.name.split(".")[0];

          // Process all sheets but prioritize current and future semesters
          const allAssignments = [];
          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0); // Start of today
          const currentYear = currentDate.getFullYear();

          // Sort sheets to prioritize current year sheets
          const sortedSheets = [...workbook.SheetNames].sort((a, b) => {
            const aYearMatch = a.match(/(\d{4})_(Spring|Fall|Summer)/);
            const bYearMatch = b.match(/(\d{4})_(Spring|Fall|Summer)/);

            const aYear = aYearMatch ? parseInt(aYearMatch[1]) : 0;
            const bYear = bYearMatch ? parseInt(bYearMatch[1]) : 0;

            // Put current and future years first
            if (aYear >= currentYear && bYear < currentYear) return -1;
            if (aYear < currentYear && bYear >= currentYear) return 1;

            // Then sort by year
            return bYear - aYear;
          });

          // Process each sheet based on our sorted priority
          for (const sheetName of sortedSheets) {
            if (verbose) console.log(`Processing sheet: ${sheetName}`);

            // Try to extract year and semester from sheet name
            const yearSemesterMatch = sheetName.match(
              /(\d{4})_(Spring|Fall|Summer)/,
            );
            let sheetYear = currentYear; // Default to current year
            let semester = "Unknown";

            if (yearSemesterMatch) {
              sheetYear = parseInt(yearSemesterMatch[1]);
              semester = yearSemesterMatch[2];

              // Only process sheets from current year or future
              if (sheetYear < currentYear) {
                if (verbose)
                  console.log(
                    `Skipping ${sheetName} as it's from a past year (${sheetYear})`,
                  );
                continue;
              }
            } else if (sheetName.includes("Spring")) {
              semester = "Spring";
            } else if (sheetName.includes("Fall")) {
              semester = "Fall";
            } else if (sheetName.includes("Summer")) {
              semester = "Summer";
            }

            // Course name with semester and year
            const courseName = `${courseCode} ${semester} ${sheetYear}`;

            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Look for the header row to identify assignment columns
            let headerRow = null;
            let headerRowIndex = -1;

            // Column mapping for different assignment types
            let pcActivityColumns = [];
            let homeworkColumns = [];
            let examColumns = [];
            let projectColumns = [];
            let topicColumn = -1;
            let dateColumns = [];

            // Find header row and identify important columns
            for (let i = 0; i < Math.min(10, jsonData.length); i++) {
              const row = jsonData[i];
              if (!row || !Array.isArray(row)) continue;

              // Check if this looks like a header row
              let foundHeader = false;
              for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                if (!cell || typeof cell !== "string") continue;

                const cellLower = cell.toLowerCase();

                if (/topic|lecture/i.test(cellLower)) {
                  topicColumn = j;
                  foundHeader = true;
                }

                if (/p&c.*due/i.test(cellLower)) {
                  pcActivityColumns.push(j);
                  foundHeader = true;
                }

                if (/hw.*due|homework.*due/i.test(cellLower)) {
                  homeworkColumns.push(j);
                  foundHeader = true;
                }

                if (/project.*due/i.test(cellLower)) {
                  projectColumns.push(j);
                  foundHeader = true;
                }

                if (/exam|midterm|final/i.test(cellLower)) {
                  examColumns.push(j);
                  foundHeader = true;
                }

                if (/date/i.test(cellLower)) {
                  dateColumns.push(j);
                  foundHeader = true;
                }
              }

              if (foundHeader) {
                headerRow = row;
                headerRowIndex = i;
                break;
              }
            }

            // If we didn't find specific columns, use default positions
            if (pcActivityColumns.length === 0) {
              pcActivityColumns = [10]; // Common column for P&C activities
            }

            if (homeworkColumns.length === 0) {
              homeworkColumns = [11]; // Common column for homework
            }

            if (topicColumn === -1) {
              topicColumn = 5; // Common column for topics
            }

            if (projectColumns.length === 0) {
              projectColumns = [12, 13]; // Common columns for projects
            }

            if (examColumns.length === 0) {
              examColumns = [topicColumn]; // Look in topic column for exams
            }

            if (dateColumns.length === 0) {
              dateColumns = [3, 6]; // Common date columns
            }

            if (verbose)
              console.log(`P&C Activity columns: ${pcActivityColumns}`);
            if (verbose) console.log(`Homework columns: ${homeworkColumns}`);
            if (verbose) console.log(`Topic column: ${topicColumn}`);
            if (verbose) console.log(`Project columns: ${projectColumns}`);

            // Process all rows after the header row
            for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || !Array.isArray(row)) continue;

              // Get row date context
              let rowDate = null;
              for (const dateCol of dateColumns) {
                if (row[dateCol] instanceof Date) {
                  rowDate = row[dateCol];
                  break;
                }
              }

              // Topic for context
              const topic = row[topicColumn] || "";

              // Process P&C Activities
              for (const colIdx of pcActivityColumns) {
                const cell = row[colIdx];
                if (!cell || typeof cell !== "string") continue;

                if (/p&c/i.test(cell)) {
                  const dueDate = parsePCActivityDueDate(
                    cell,
                    rowDate,
                    sheetYear,
                  );

                  // Only include if due date is valid and not in the past
                  if (dueDate && !isDateInPast(dueDate)) {
                    // Clean up title by removing due date part
                    let title = cell
                      .replace(/due\s+by\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i, "")
                      .replace(/^p&c\s+activity\s*/i, "P&C Activity ") // Standardize prefix format
                      .replace(/^hw\s*/i, "Homework ") // Standardize homework prefix
                      .trim();

                    const formattedDate = formatDate(dueDate);

                    allAssignments.push({
                      title: title,
                      dueDate: formattedDate,
                      course: courseName,
                      description: topic,
                      type: "P&C Activity",
                      fileName: file.name,
                    });
                  }
                }
              }

              // Process Homework
              for (const colIdx of homeworkColumns) {
                const cell = row[colIdx];
                if (!cell || typeof cell !== "string") continue;

                if (/hw\s+\d+|homework/i.test(cell)) {
                  const dueDate = parseHomeworkDueDate(
                    cell,
                    rowDate,
                    sheetYear,
                  );

                  // Only include if due date is valid and not in the past
                  if (dueDate && !isDateInPast(dueDate)) {
                    // Clean up title
                    let title = cell;
                    if (/due\s+by/i.test(cell)) {
                      title = cell
                        .replace(
                          /due\s+by\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/i,
                          "",
                        )
                        .trim();
                    }

                    const formattedDate = formatDate(dueDate);

                    allAssignments.push({
                      title: title,
                      dueDate: formattedDate,
                      course: courseName,
                      description: topic,
                      type: "Homework",
                      fileName: file.name,
                    });
                  }
                }
              }

              // Process Projects
              for (const colIdx of projectColumns) {
                const cell = row[colIdx];
                if (!cell || typeof cell !== "string") continue;

                if (/project/i.test(cell)) {
                  const dueDate = parseProjectDueDate(cell, rowDate, sheetYear);

                  // Only include if due date is valid and not in the past
                  if (dueDate && !isDateInPast(dueDate)) {
                    // Extract project number
                    const projectMatch = cell.match(/PROJECT\s+(\d+)/i);
                    const projectNumber = projectMatch ? projectMatch[1] : "";
                    const title = `Project ${projectNumber}`.trim();

                    const formattedDate = formatDate(dueDate);

                    allAssignments.push({
                      title: title,
                      dueDate: formattedDate,
                      course: courseName,
                      description: `${topic} - ${cell}`.trim(),
                      type: "Project",
                      fileName: file.name,
                    });
                  }
                }
              }

              // Process Exams
              for (const colIdx of examColumns) {
                const cell = row[colIdx];
                if (!cell || typeof cell !== "string") continue;

                const examInfo = parseExamDate(cell, rowDate, sheetYear);
                if (examInfo && !isDateInPast(examInfo.date)) {
                  const formattedDate = formatDate(examInfo.date);

                  allAssignments.push({
                    title: examInfo.type,
                    dueDate: formattedDate,
                    course: courseName,
                    description: cell,
                    type: examInfo.type,
                    fileName: file.name,
                  });
                }
              }
            }
          }
          const uniqueAssignments = [];
          const seen = new Set();

          allAssignments.forEach((assignment) => {
            // Create a key based on title and date to detect duplicates
            const key = `${assignment.title}-${assignment.dueDate}-${assignment.course}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueAssignments.push(assignment);
            }
          });

          if (verbose)
            console.log(
              `Found ${allAssignments.length} assignments, ${uniqueAssignments.length} unique`,
            );
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
