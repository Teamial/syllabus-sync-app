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
export function parseTimelineSheet(
  jsonData,
  courseName,
  currentYear = new Date().getFullYear(),
) {
  // Defensive programming: check parameters
  if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
    console.warn("Invalid data passed to parseTimelineSheet");
    return [];
  }

  const assignments = [];
  console.log(`Starting to parse timeline sheet for course: ${courseName}`);
  console.log(`Data has ${jsonData.length} rows`);

  try {
    // Analyze the structure to find column headers
    const columnMap = analyzeTimelineStructure(jsonData[0]);
    
    // Log column mapping for debugging
    console.log("Column mapping found:", columnMap);
    
    // Log if we didn't find any useful columns
    if (!columnMap.dateColumn && !columnMap.dueDateColumn && !columnMap.weekColumn) {
      console.warn("No date or week columns found in the timeline sheet");
    }
    if (!columnMap.pcColumn && !columnMap.hwColumn && !columnMap.assignmentColumn && 
        !columnMap.topicColumn && !columnMap.labColumn && !columnMap.contentColumn && 
        !columnMap.descriptionColumn) {
      console.warn("No assignment or content columns found in the timeline sheet");
    }

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      try {
        const row = jsonData[i];
        
        // Skip header row
        if (i === 0) continue;
        
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) {
          console.log(`Skipping empty row at index ${i}`);
          continue;
        }

        // Try to get date from various possible columns
        let dateValue = 
          row[columnMap.dateColumn] || 
          row[columnMap.dueDateColumn] || 
          row.Date || 
          row.date || 
          row["Due Date"] || 
          row["DUE DATE"] ||
          row["due date"] ||
          row["Due date"] ||
          row["deadline"] ||
          row["Deadline"];
          
        // If no date found but we have a week column, try to extract a date from it
        if (!dateValue && columnMap.weekColumn && row[columnMap.weekColumn]) {
          const weekValue = String(row[columnMap.weekColumn]);
          console.log(`No direct date found, trying to extract from week value: ${weekValue}`);
          
          // Look for date patterns in the week column
          const dateMatch = weekValue.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/);
          if (dateMatch) {
            dateValue = dateMatch[1];
            console.log(`Extracted date ${dateValue} from week column`);
          }
        }
          
        // If still no date, check all columns for date patterns
        if (!dateValue) {
          console.log(`No date found in standard columns for row ${i}, checking all columns for date patterns`);
          
          // Check all columns for date patterns
          for (const key in row) {
            if (typeof row[key] === 'string' || typeof row[key] === 'number') {
              const value = String(row[key]);
              const dateMatch = value.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/);
              if (dateMatch) {
                dateValue = dateMatch[1];
                console.log(`Found date pattern ${dateValue} in column ${key}`);
                break;
              }
            }
          }
        }
        
        // If still no date, try to use the previous valid date
        if (!dateValue && i > 1 && assignments.length > 0) {
          // Get the most recent assignment's date
          const lastAssignment = assignments[assignments.length - 1];
          if (lastAssignment && lastAssignment.dueDate) {
            dateValue = lastAssignment.dueDate;
            console.log(`Using previous assignment's date: ${dateValue} for row ${i}`);
          }
        }
        
        if (!dateValue) {
          console.log(`No date found in row ${i}, skipping`);
          continue;
        }

        const rowDate = parseDate(dateValue, currentYear);

        // Skip invalid dates
        if (!rowDate) {
          console.log(`Invalid date in row ${i}: ${dateValue}`);
          continue;
        }
        
        console.log(`Processing row ${i} with date: ${formatDate(rowDate)}`);

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
            console.log(`Found P&C activity: ${pcActivity.title}`);
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
            console.log(`Found homework: ${homework.title}`);
            assignments.push(homework);
          }
        }

        // Look for exams in lecture topics
        if (
          columnMap.topicColumn &&
          row[columnMap.topicColumn] &&
          typeof row[columnMap.topicColumn] === "string"
        ) {
          // Check for exam keywords
          const topicText = row[columnMap.topicColumn].toLowerCase();
          if (topicText.includes("exam") || topicText.includes("test") || 
              topicText.includes("quiz") || topicText.includes("midterm") || 
              topicText.includes("final")) {
            const exam = extractExam(
              row[columnMap.topicColumn],
              rowDate,
              courseName,
            );
            if (exam) {
              console.log(`Found exam: ${exam.title}`);
              assignments.push(exam);
            }
          } else if (topicText.includes("homework") || topicText.includes("hw") || 
                     topicText.includes("assignment") || topicText.includes("project")) {
            // If topic contains assignment keywords, extract as generic assignment
            const assignment = extractGenericAssignment(
              row[columnMap.topicColumn],
              rowDate,
              courseName,
            );
            if (assignment) {
              console.log(`Found assignment in topic: ${assignment.title}`);
              assignments.push(assignment);
            }
          }
        }

        // Look for projects or assignments in lab session topics
        if (
          columnMap.labColumn &&
          row[columnMap.labColumn] &&
          typeof row[columnMap.labColumn] === "string"
        ) {
          const labText = row[columnMap.labColumn].toLowerCase();
          if (labText.includes("project") || labText.includes("assignment") || 
              labText.includes("homework") || labText.includes("hw") || 
              labText.includes("exercise") || labText.includes("task")) {
            const project = extractProject(
              row[columnMap.labColumn],
              rowDate,
              courseName,
            );
            if (project) {
              console.log(`Found project/assignment in lab: ${project.title}`);
              assignments.push(project);
            }
          }
        }
        
        // Extract general assignments from assignment column
        if (
          columnMap.assignmentColumn &&
          row[columnMap.assignmentColumn] &&
          typeof row[columnMap.assignmentColumn] === "string" &&
          row[columnMap.assignmentColumn].trim() !== ""
        ) {
          const assignment = extractGenericAssignment(
            row[columnMap.assignmentColumn],
            rowDate,
            courseName,
          );
          if (assignment) {
            console.log(`Found assignment: ${assignment.title}`);
            assignments.push(assignment);
          }
        }
        
        // Check description or content columns for assignments
        if (
          columnMap.descriptionColumn &&
          row[columnMap.descriptionColumn] &&
          typeof row[columnMap.descriptionColumn] === "string" &&
          row[columnMap.descriptionColumn].trim() !== ""
        ) {
          const descText = row[columnMap.descriptionColumn].toLowerCase();
          if (descText.includes("homework") || descText.includes("hw") || 
              descText.includes("assignment") || descText.includes("project") || 
              descText.includes("due") || descText.includes("submit") || 
              descText.includes("deadline")) {
            const assignment = extractGenericAssignment(
              row[columnMap.descriptionColumn],
              rowDate,
              courseName,
            );
            if (assignment) {
              console.log(`Found assignment in description: ${assignment.title}`);
              assignments.push(assignment);
            }
          }
        }
        
        // If we still haven't found any assignments in this row but there's content,
        // check all columns for assignment-like content
        if (assignments.length === 0 || 
            (assignments.length > 0 && assignments[assignments.length-1].dueDate !== formatDate(rowDate))) {
          console.log(`No assignments found yet for row ${i}, checking all columns`);
          
          for (const key in row) {
            // Skip columns we've already checked
            if (key === columnMap.dateColumn || key === columnMap.dueDateColumn || 
                key === columnMap.pcColumn || key === columnMap.hwColumn || 
                key === columnMap.topicColumn || key === columnMap.labColumn || 
                key === columnMap.assignmentColumn || key === columnMap.descriptionColumn) {
              continue;
            }
            
            if (typeof row[key] === 'string' && row[key].trim() !== '') {
              const cellText = row[key].toLowerCase();
              if (cellText.includes('homework') || cellText.includes('hw') || 
                  cellText.includes('assignment') || cellText.includes('project') || 
                  cellText.includes('due') || cellText.includes('submit') || 
                  cellText.includes('task') || cellText.includes('quiz') || 
                  cellText.includes('exam') || cellText.includes('test')) {
                
                const assignment = extractGenericAssignment(
                  row[key],
                  rowDate,
                  courseName
                );
                if (assignment) {
                  console.log(`Found assignment in column ${key}: ${assignment.title}`);
                  assignments.push(assignment);
                  break; // Found an assignment, no need to check other columns
                }
              }
            }
          }
        }
      } catch (rowError) {
        console.warn(`Error processing timeline row ${i}:`, rowError);
        // Continue to next row rather than failing the whole sheet
      }
    }

    // Make sure we return basic objects without any connection to the workbook
    const result = assignments.map((item) => ({
      title: String(item.title || ""),
      dueDate: String(item.dueDate || ""),
      course: String(item.course || ""),
      description: String(item.description || ""),
      type: String(item.type || "Assignment"),
    }));
    
    // Log warning if no assignments were found
    if (result.length === 0) {
      console.warn(`No assignments found for course: ${courseName}. This could be due to:`);
      console.warn("1. No date columns were identified in the sheet");
      console.warn("2. No assignment columns were identified in the sheet");
      console.warn("3. The dates in the sheet could not be parsed correctly");
      console.warn("4. The assignment data format is not recognized");
      console.warn("Column mapping found:", columnMap);
    } else {
      console.log(`Successfully extracted ${result.length} assignments for course: ${courseName}`);
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing timeline data:", error);
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
      assignmentColumn: null,
      dueDateColumn: null,
      weekColumn: null,
      contentColumn: null,
      descriptionColumn: null,
    };

  const columnMap = {
    dateColumn: null,
    pcColumn: null,
    hwColumn: null,
    topicColumn: null,
    labColumn: null,
    assignmentColumn: null,
    dueDateColumn: null,
    weekColumn: null,
    contentColumn: null,
    descriptionColumn: null,
  };

  // Debug logging
  console.log("Analyzing header row:", headerRow);

  // Go through all properties in the header row
  Object.keys(headerRow).forEach((key) => {
    const lowerKey = String(key).toLowerCase();
    const value = String(headerRow[key] || "").toLowerCase();
    
    console.log(`Analyzing column: ${key} with value: ${value}`);

    // Check both key and value for matches
    // Date column detection - more comprehensive patterns
    if (
      lowerKey.includes("date") || 
      value.includes("date") ||
      /\b(day|when)\b/.test(lowerKey) ||
      /\b(day|when)\b/.test(value) ||
      /\b(\d{1,2}[\/\-]\d{1,2})\b/.test(value) // Contains date pattern like MM/DD
    ) {
      // If it's specifically a due date, mark it as such
      if (lowerKey.includes("due") || value.includes("due") || value.includes("deadline")) {
        columnMap.dueDateColumn = key;
        console.log(`Found due date column: ${key}`);
      } else {
        columnMap.dateColumn = key;
        console.log(`Found date column: ${key}`);
      }
    }
    // Week column detection
    else if (
      lowerKey.includes("week") || 
      value.includes("week") ||
      /\bwk\b/.test(lowerKey) ||
      /\bwk\b/.test(value)
    ) {
      columnMap.weekColumn = key;
      console.log(`Found week column: ${key}`);
    }
    // Check for P&C activities - expanded patterns
    else if (
      lowerKey.includes("p&c") ||
      lowerKey.includes("p & c") ||
      lowerKey.includes("activity") ||
      lowerKey.includes("activities") ||
      value.includes("p&c") ||
      value.includes("p & c") ||
      value.includes("activity") ||
      value.includes("activities") ||
      /\bact\b/.test(lowerKey) ||
      /\bact\b/.test(value)
    ) {
      columnMap.pcColumn = key;
      console.log(`Found P&C column: ${key}`);
    } 
    // Check for homework - expanded patterns
    else if (
      lowerKey.includes("hw") ||
      lowerKey.includes("homework") ||
      lowerKey.includes("assignment") ||
      value.includes("hw") ||
      value.includes("homework") ||
      value.includes("assignment") ||
      /\bhw ?\d+\b/i.test(value) // Matches patterns like "HW1", "HW 2", etc.
    ) {
      columnMap.hwColumn = key;
      console.log(`Found homework column: ${key}`);
    } 
    // Check for lecture/topic - expanded patterns
    else if (
      lowerKey.includes("lecture") ||
      lowerKey.includes("topic") ||
      lowerKey.includes("subject") ||
      lowerKey.includes("content") ||
      value.includes("lecture") ||
      value.includes("topic") ||
      value.includes("subject") ||
      value.includes("content")
    ) {
      columnMap.topicColumn = key;
      console.log(`Found topic column: ${key}`);
    } 
    // Check for lab - expanded patterns
    else if (
      lowerKey.includes("lab") || 
      value.includes("lab") ||
      lowerKey.includes("practical") ||
      value.includes("practical") ||
      lowerKey.includes("exercise") ||
      value.includes("exercise")
    ) {
      columnMap.labColumn = key;
      console.log(`Found lab column: ${key}`);
    }
    // Check for general assignment column - expanded patterns
    else if (
      lowerKey.includes("assign") ||
      lowerKey.includes("task") ||
      lowerKey.includes("work") ||
      lowerKey.includes("project") ||
      lowerKey.includes("deliverable") ||
      lowerKey.includes("submission") ||
      value.includes("assign") ||
      value.includes("task") ||
      value.includes("work") ||
      value.includes("project") ||
      value.includes("deliverable") ||
      value.includes("submission")
    ) {
      columnMap.assignmentColumn = key;
      console.log(`Found assignment column: ${key}`);
    }
    // Check for content or description columns
    else if (
      lowerKey.includes("content") ||
      lowerKey.includes("description") ||
      lowerKey.includes("details") ||
      lowerKey.includes("notes") ||
      value.includes("content") ||
      value.includes("description") ||
      value.includes("details") ||
      value.includes("notes")
    ) {
      columnMap.descriptionColumn = key;
      console.log(`Found description column: ${key}`);
    }
  });

  // If we found a due date column but no date column, use due date as the date column
  if (!columnMap.dateColumn && columnMap.dueDateColumn) {
    columnMap.dateColumn = columnMap.dueDateColumn;
    console.log(`Using due date column as date column: ${columnMap.dateColumn}`);
  }

  console.log("Final column mapping:", columnMap);

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
 * Extract homework assignment from cell text
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

  const lowerText = cellText.toLowerCase();
  
  // Skip if not exam related - expanded keywords
  if (
    !lowerText.includes("exam") &&
    !lowerText.includes("midterm") &&
    !lowerText.includes("final") &&
    !lowerText.includes("test") &&
    !lowerText.includes("quiz") &&
    !lowerText.includes("assessment")
  ) {
    return null;
  }

  // Find specific date if mentioned
  const dueDateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  let dueDate = rowDate;

  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3]
      ? parseInt(dueDateMatch[3])
      : rowDate.getFullYear();

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    dueDate = new Date(year, month - 1, day);
  }

  // Determine exam type
  let examType = "Exam";
  let title = "Exam";
  
  // Extract exam number if available
  const examMatch = cellText.match(/(?:exam|test)\s*(?:#)?(\d+)/i);
  const examNum = examMatch ? examMatch[1] : "";
  
  if (lowerText.includes("midterm")) {
    examType = "Midterm Exam";
    title = examNum ? `Midterm Exam ${examNum}` : "Midterm Exam";
  } else if (lowerText.includes("final")) {
    examType = "Final Exam";
    title = "Final Exam";
  } else if (lowerText.includes("quiz")) {
    examType = "Quiz";
    title = examNum ? `Quiz ${examNum}` : "Quiz";
  } else {
    title = examNum ? `Exam ${examNum}` : "Exam";
  }

  return {
    title: title,
    dueDate: formatDate(dueDate),
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

  const lowerText = cellText.toLowerCase();
  
  // Skip if not project or assignment related - expanded keywords
  if (
    !lowerText.includes("project") &&
    !lowerText.includes("assignment") &&
    !lowerText.includes("homework") &&
    !lowerText.includes("hw") &&
    !lowerText.includes("lab") &&
    !lowerText.includes("exercise") &&
    !lowerText.includes("task")
  ) {
    return null;
  }

  // Find specific date if mentioned
  const dueDateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  let dueDate = rowDate;

  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3]
      ? parseInt(dueDateMatch[3])
      : rowDate.getFullYear();

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    dueDate = new Date(year, month - 1, day);
  }

  // Determine assignment type and title
  let type = "Assignment";
  let title = "Assignment";
  let assignmentNum = "";
  
  // Try to extract assignment number based on type
  if (lowerText.includes("project")) {
    type = "Project";
    const projectMatch = cellText.match(/project\s*(?:#)?(\d+)/i);
    assignmentNum = projectMatch ? projectMatch[1] : "";
    title = assignmentNum ? `Project ${assignmentNum}` : "Project";
  } else if (lowerText.includes("lab")) {
    type = "Lab";
    const labMatch = cellText.match(/lab\s*(?:#)?(\d+)/i);
    assignmentNum = labMatch ? labMatch[1] : "";
    title = assignmentNum ? `Lab ${assignmentNum}` : "Lab Assignment";
  } else if (lowerText.includes("homework") || lowerText.includes("hw")) {
    type = "Homework";
    const hwMatch = cellText.match(/(?:homework|hw)\s*(?:#)?(\d+)/i);
    assignmentNum = hwMatch ? hwMatch[1] : "";
    title = assignmentNum ? `Homework ${assignmentNum}` : "Homework";
  } else if (lowerText.includes("assignment")) {
    type = "Assignment";
    const assignMatch = cellText.match(/assignment\s*(?:#)?(\d+)/i);
    assignmentNum = assignMatch ? assignMatch[1] : "";
    title = assignmentNum ? `Assignment ${assignmentNum}` : "Assignment";
  } else if (lowerText.includes("exercise")) {
    type = "Exercise";
    const exMatch = cellText.match(/exercise\s*(?:#)?(\d+)/i);
    assignmentNum = exMatch ? exMatch[1] : "";
    title = assignmentNum ? `Exercise ${assignmentNum}` : "Exercise";
  } else {
    // Generic task
    const taskMatch = cellText.match(/task\s*(?:#)?(\d+)/i);
    assignmentNum = taskMatch ? taskMatch[1] : "";
    title = assignmentNum ? `Task ${assignmentNum}` : "Task";
  }
  
  // Use a short version of the cell text as title if no number was found
  if (!assignmentNum && cellText.length < 50) {
    // Clean up the title
    let cleanTitle = cellText.trim();
    const prefixes = ["due:", "due", "submit:", "submit"];
    for (const prefix of prefixes) {
      if (cleanTitle.toLowerCase().startsWith(prefix)) {
        cleanTitle = cleanTitle.substring(prefix.length).trim();
        break;
      }
    }
    title = cleanTitle;
  }

  return {
    title: title,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: cellText,
    type: type,
  };
}

/**
 * Extract generic assignment from cell text
 */
function extractGenericAssignment(cellText, rowDate, courseName) {
  if (!cellText || !rowDate) return null;

  // Skip empty assignments or placeholders
  if (cellText === "-" || cellText.trim() === "" || 
      cellText === "N/A" || cellText === "TBD") return null;
  
  const lowerText = cellText.toLowerCase();
  
  // Skip if it's clearly not an assignment (common non-assignment phrases)
  if ((lowerText === "no class" || lowerText === "holiday" || 
       lowerText === "break" || lowerText === "vacation" || 
       lowerText === "no lecture" || lowerText === "cancelled") && 
      !lowerText.includes("due") && !lowerText.includes("submit") && 
      !lowerText.includes("assignment") && !lowerText.includes("homework")) {
    return null;
  }
  
  // Try to extract assignment number if available - expanded patterns
  let assignmentNum = "";
  const assignmentMatches = [
    // Match "Assignment 1", "Assignment #1", etc.
    cellText.match(/(?:assignment|task)\s*(?:#)?(\d+)/i),
    // Match "HW 1", "HW#1", etc.
    cellText.match(/(?:hw|homework)\s*(?:#)?(\d+)/i),
    // Match "Project 1", "Project #1", etc.
    cellText.match(/(?:project|proj)\s*(?:#)?(\d+)/i),
    // Match "Lab 1", "Lab #1", etc.
    cellText.match(/(?:lab|laboratory)\s*(?:#)?(\d+)/i),
    // Match "Quiz 1", "Quiz #1", etc.
    cellText.match(/(?:quiz)\s*(?:#)?(\d+)/i),
    // Match "Exercise 1", "Exercise #1", etc.
    cellText.match(/(?:exercise|ex)\s*(?:#)?(\d+)/i)
  ];
  
  // Use the first match found
  for (const match of assignmentMatches) {
    if (match) {
      assignmentNum = match[1];
      break;
    }
  }
  
  // Find specific date if mentioned
  const dueDateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  let dueDate = rowDate;

  if (dueDateMatch) {
    const month = parseInt(dueDateMatch[1]);
    const day = parseInt(dueDateMatch[2]);
    let year = dueDateMatch[3]
      ? parseInt(dueDateMatch[3])
      : rowDate.getFullYear();

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    dueDate = new Date(year, month - 1, day);
  }
  
  // Determine assignment type based on content
  let type = "Assignment";
  let title = "Assignment";
  
  // Check for specific assignment types - more comprehensive detection
  if (lowerText.includes("quiz")) {
    type = "Quiz";
    title = assignmentNum ? `Quiz ${assignmentNum}` : "Quiz";
  } else if (lowerText.includes("exam") || lowerText.includes("test")) {
    if (lowerText.includes("midterm")) {
      type = "Midterm Exam";
      title = "Midterm Exam";
    } else if (lowerText.includes("final")) {
      type = "Final Exam";
      title = "Final Exam";
    } else {
      type = "Exam";
      title = assignmentNum ? `Exam ${assignmentNum}` : "Exam";
    }
  } else if (lowerText.includes("lab")) {
    type = "Lab";
    title = assignmentNum ? `Lab ${assignmentNum}` : "Lab Assignment";
  } else if (lowerText.includes("project")) {
    type = "Project";
    title = assignmentNum ? `Project ${assignmentNum}` : "Project";
  } else if (lowerText.includes("report") || lowerText.includes("paper")) {
    type = "Report";
    title = assignmentNum ? `Report ${assignmentNum}` : "Report";
  } else if (lowerText.includes("presentation") || lowerText.includes("speech")) {
    type = "Presentation";
    title = assignmentNum ? `Presentation ${assignmentNum}` : "Presentation";
  } else if (lowerText.includes("homework") || lowerText.includes("hw")) {
    type = "Homework";
    title = assignmentNum ? `Homework ${assignmentNum}` : "Homework";
  } else if (lowerText.includes("assignment")) {
    type = "Assignment";
    title = assignmentNum ? `Assignment ${assignmentNum}` : "Assignment";
  }
  
  // Use the cell text as title if it's short enough and doesn't have a number already assigned
  if (cellText.length < 50 && !assignmentNum) {
    // Clean up the title - remove common prefixes and trim
    let cleanTitle = cellText.trim();
    const prefixes = ["due:", "due", "submit:", "submit", "assignment:", "homework:"];
    for (const prefix of prefixes) {
      if (cleanTitle.toLowerCase().startsWith(prefix)) {
        cleanTitle = cleanTitle.substring(prefix.length).trim();
        break;
      }
    }
    title = cleanTitle;
  }

  return {
    title: title,
    dueDate: formatDate(dueDate),
    course: courseName,
    description: cellText,
    type: type,
  };
}

/**
 * Detect if the workbook contains a timeline format
 */
export function detectTimelineFormat(workbook) {
  if (!workbook || !workbook.SheetNames || !workbook.Sheets) {
    console.warn("Invalid workbook structure");
    return false;
  }

  let hasTimelineFormat = false;
  console.log(`Analyzing workbook with ${workbook.SheetNames.length} sheets`);

  try {
    // First check: Look for timeline indicators in the workbook name if available
    if (workbook.Props && workbook.Props.Title) {
      const title = workbook.Props.Title.toLowerCase();
      if (title.includes('timeline') || title.includes('schedule') || 
          title.includes('syllabus') || title.includes('course') || 
          title.includes('class') || title.includes('semester')) {
        console.log(`Timeline format detected based on workbook title: ${workbook.Props.Title}`);
        hasTimelineFormat = true;
      }
    }
    
    // Check each sheet even if we already detected a timeline format
    // This helps with logging and might find better sheets to parse
    for (const sheetName of workbook.SheetNames) {
      console.log(`Analyzing sheet: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      
      // Skip sheets that look like they contain metadata/info
      if (/info|metadata|readme|about/i.test(sheetName)) {
        console.log(`Skipping metadata sheet: ${sheetName}`);
        continue;
      }
      
      // Try both header and non-header JSON conversion
      const jsonDataWithHeader = XLSX.utils.sheet_to_json(sheet);
      const jsonDataRaw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Skip empty sheets
      if ((!jsonDataWithHeader || jsonDataWithHeader.length === 0) && 
          (!jsonDataRaw || jsonDataRaw.length < 2)) {
        console.log(`Skipping empty sheet: ${sheetName}`);
        continue;
      }

      // Check: Look at sheet name for timeline indicators
      const sheetNameLower = sheetName.toLowerCase();
      if (/schedule|timeline|calendar|syllabus|\d{4}|course|class|semester|outline/i.test(sheetNameLower) ||
          /fall|spring|summer|winter|week|session|lecture|topic/i.test(sheetNameLower) ||
          /cmp\d+|cs\d+|comp\d+/i.test(sheetNameLower)) { // Common course code patterns
        console.log(`Timeline format detected based on sheet name: ${sheetName}`);
        hasTimelineFormat = true;
      }

      // Check: Look at column headers in the JSON with headers
      if (jsonDataWithHeader.length > 0) {
        const firstRow = jsonDataWithHeader[0];
        const headers = Object.keys(firstRow).join(" ").toLowerCase();
        console.log(`Headers found: ${headers}`);
        
        // Check for common timeline header patterns - expanded patterns
        if (headers.includes("date") || 
            headers.includes("week") || 
            headers.includes("due") || 
            headers.includes("assign") ||
            headers.includes("homework") ||
            headers.includes("hw") ||
            headers.includes("activity") ||
            headers.includes("task") ||
            headers.includes("topic") ||
            headers.includes("lecture") ||
            headers.includes("session") ||
            headers.includes("class") ||
            headers.includes("day") ||
            headers.includes("deadline") ||
            headers.includes("project") ||
            headers.includes("exam") ||
            headers.includes("quiz")) {
          console.log(`Timeline format detected in sheet ${sheetName} based on headers`);
          hasTimelineFormat = true;
        }
        
        // Also check for date patterns in the header values
        const headerValues = Object.values(firstRow).join(" ").toLowerCase();
        if (/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/.test(headerValues)) {
          console.log(`Timeline format detected in sheet ${sheetName} based on date patterns in header values`);
          hasTimelineFormat = true;
        }
      }

      // Check: Look at the first few rows for patterns
      const rowsToCheck = Math.min(10, jsonDataRaw.length); // Increased from 5 to 10 rows
      console.log(`Checking first ${rowsToCheck} rows for timeline patterns`);
      
      for (let i = 0; i < rowsToCheck; i++) {
        const row = jsonDataRaw[i];
        if (!row || !Array.isArray(row)) continue;
        
        // Convert row to string for pattern matching
        const rowStr = row.join(" ").toLowerCase();
        
        // Check for date patterns in the row
        const hasDatePattern = /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/.test(rowStr);
        
        // Check for common timeline patterns - expanded patterns
        if (
          // Pattern 1: Contains date and any of these keywords
          (rowStr.includes("date") && 
           (rowStr.includes("week") || 
            rowStr.includes("lecture") || 
            rowStr.includes("lab") || 
            rowStr.includes("topic") ||
            rowStr.includes("class") ||
            rowStr.includes("session"))) ||
          // Pattern 2: Contains homework or activity references
          (rowStr.includes("hw") || 
           rowStr.includes("homework") || 
           rowStr.includes("p&c") || 
           rowStr.includes("activity") ||
           rowStr.includes("assignment") ||
           rowStr.includes("project") ||
           rowStr.includes("task") ||
           rowStr.includes("quiz") ||
           rowStr.includes("exam")) ||
          // Pattern 3: Contains due date references
          (rowStr.includes("due") && (rowStr.includes("date") || hasDatePattern)) ||
          // Pattern 4: Contains date pattern and looks like a schedule
          (hasDatePattern && 
           (rowStr.includes("schedule") || 
            rowStr.includes("syllabus") ||
            rowStr.includes("timeline") ||
            rowStr.includes("calendar"))) ||
          // Pattern 5: Contains multiple date patterns (likely a schedule)
          ((rowStr.match(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g) || []).length >= 2) ||
          // Pattern 6: Contains day names and date patterns
          ((rowStr.includes("monday") || rowStr.includes("tuesday") || 
            rowStr.includes("wednesday") || rowStr.includes("thursday") || 
            rowStr.includes("friday") || rowStr.includes("saturday") || 
            rowStr.includes("sunday")) && hasDatePattern) ||
          // Pattern 7: Contains course-specific keywords
          (rowStr.includes("cmp") || rowStr.includes("cs") || rowStr.includes("comp")) && 
          (rowStr.includes("class") || rowStr.includes("lecture") || rowStr.includes("lab"))
        ) {
          console.log(`Timeline format detected in sheet ${sheetName} at row ${i}`);
          console.log(`Matching pattern: ${rowStr}`);
          hasTimelineFormat = true;
          break;
        }
      }
      
      // If we've found a timeline format in this sheet, we can stop checking
      if (hasTimelineFormat) {
        console.log(`Timeline format confirmed in sheet: ${sheetName}`);
        break;
      }
    }
    
    // Last resort: If no timeline format detected but the file has a single sheet,
    // assume it's a timeline format (many course schedules are in a single sheet)
    if (!hasTimelineFormat && workbook.SheetNames.length === 1) {
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      
      // Only assume it's a timeline if it has a reasonable number of rows
      if (jsonData.length >= 5) {
        console.log(`No timeline format explicitly detected, but assuming single sheet with ${jsonData.length} rows is a timeline`);
        hasTimelineFormat = true;
      }
    }
  } catch (error) {
    console.warn("Error detecting timeline format:", error);
    return false;
  }

  console.log(`Timeline format detection result: ${hasTimelineFormat}`);
  return hasTimelineFormat;
}
