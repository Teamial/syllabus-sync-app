// components/TimelineParser.js - Improved version

import { parseDate, formatDate, isDateInPast } from "./DateUtils";

/**
 * Detect if the workbook contains a timeline format
 * @param {Object} workbook - XLSX workbook object
 * @returns {Boolean} - True if the workbook appears to be in timeline format
 */
export function detectTimelineFormat(workbook) {
  if (!workbook || !workbook.SheetNames || !workbook.Sheets) {
    console.warn("Invalid workbook structure");
    return false;
  }

  // Always return true to ensure we attempt timeline parsing
  // This is a temporary fix to ensure we don't skip timeline parsing
  console.log("Force-enabling timeline format detection");
  return true;
}

/**
 * Parses timeline or course schedule formatted Excel data
 * @param {Array} jsonData - Array of objects representing sheet rows
 * @param {String} courseName - Course name extracted from filename
 * @param {Number} currentYear - Current year for date context
 * @returns {Array} - Array of assignment objects
 */
export function parseTimelineSheet(jsonData, courseName, currentYear = new Date().getFullYear()) {
  // Defensive programming: check parameters
  if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
    console.warn("Invalid data passed to parseTimelineSheet");
    return [];
  }

  const assignments = [];
  console.log(`Starting to parse timeline sheet for course: ${courseName}`);
  console.log(`Data has ${jsonData.length} rows`);
  
  // Log the first row to understand what headers are available
  if (jsonData.length > 0) {
    console.log("First row of data:", JSON.stringify(jsonData[0]));
  }

  try {
    // Process each row to look for assignments
    jsonData.forEach((row, rowIndex) => {
      // Skip empty rows
      if (!row || Object.keys(row).length === 0) return;
      
      // Log each row for debugging
      console.log(`Processing row ${rowIndex}:`, JSON.stringify(row));
      
      // Find a date in the row - check all possible date columns
      let dateValue = null;
      
      // Check common date column names
      const dateColumnCandidates = [
        "Date", "DUE DATE", "Due Date", "Due date", "date", "Deadline", "deadline", 
        "Due By", "due by", "When"
      ];
      
      // Try to find a date in any of the candidate columns
      for (const candidate of dateColumnCandidates) {
        if (row[candidate] !== undefined && row[candidate] !== null && row[candidate] !== "") {
          dateValue = row[candidate];
          console.log(`Found date value in column "${candidate}": ${dateValue}`);
          break;
        }
      }
      
      // If no date found in common columns, look for any property that might contain a date
      if (!dateValue) {
        for (const key in row) {
          const value = row[key];
          // If the value looks like a date string or number (Excel date)
          if (value && (typeof value === 'string' || typeof value === 'number')) {
            try {
              const possibleDate = parseDate(value, currentYear);
              if (possibleDate && !isNaN(possibleDate.getTime())) {
                dateValue = value;
                console.log(`Found potential date in column "${key}": ${dateValue}`);
                break;
              }
            } catch (e) {
              // Not a date, continue checking other columns
            }
          }
        }
      }
      
      // If still no date, look for date patterns in string values
      if (!dateValue) {
        for (const key in row) {
          if (typeof row[key] === 'string') {
            const dateMatch = row[key].match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
            if (dateMatch) {
              dateValue = row[key];
              console.log(`Found date pattern in column "${key}": ${dateValue}`);
              break;
            }
          }
        }
      }
      
      // If we still don't have a date, skip this row
      if (!dateValue) {
        console.log(`No date found in row ${rowIndex}, skipping`);
        return;
      }
      
      // Parse the date
      const rowDate = parseDate(dateValue, currentYear);
      
      // Skip invalid dates or dates in the past
      if (!rowDate) {
        console.log(`Invalid date in row ${rowIndex}: ${dateValue}`);
        return;
      }
      
      if (isDateInPast(rowDate)) {
        console.log(`Skipping past date in row ${rowIndex}: ${formatDate(rowDate)}`);
        return;
      }
      
      console.log(`Valid date found for row ${rowIndex}: ${formatDate(rowDate)}`);
      
      // Now look for assignments in this row
      
      // Function to extract assignments from a column value
      const extractAssignmentFromValue = (colValue, colName) => {
        if (!colValue || typeof colValue !== 'string' || colValue.trim() === '') return null;
        
        const lowerValue = colValue.toLowerCase();
        
        // Skip if it doesn't look like an assignment
        if (lowerValue === 'n/a' || lowerValue === '-' || lowerValue === 'none' || 
            lowerValue === 'no class' || lowerValue === 'holiday') {
          return null;
        }
        
        // Determine assignment type
        let type = "Assignment";
        let title = "Assignment";
        
        // Check for known assignment types
        if (colName.toLowerCase().includes("hw") || 
            colName.toLowerCase().includes("homework") || 
            lowerValue.includes("hw") || 
            lowerValue.includes("homework")) {
          
          type = "Homework";
          
          // Try to extract homework number
          const hwMatch = lowerValue.match(/(?:homework|hw)\s*(?:#|\s)?(\d+)/i);
          const hwNum = hwMatch ? hwMatch[1] : "";
          title = hwNum ? `Homework ${hwNum}` : "Homework";
          
        } else if (colName.toLowerCase().includes("p&c") || 
                  colName.toLowerCase().includes("activity") || 
                  lowerValue.includes("p&c") || 
                  lowerValue.includes("activity")) {
          
          type = "P&C Activity";
          
          // Try to extract activity number
          const actMatch = lowerValue.match(/(?:p&c|activity)\s*(?:#|\s)?(\d+)/i);
          const actNum = actMatch ? actMatch[1] : "";
          title = actNum ? `P&C Activity ${actNum}` : "P&C Activity";
          
        } else if (lowerValue.includes("exam") || 
                  lowerValue.includes("midterm") || 
                  lowerValue.includes("final") || 
                  lowerValue.includes("test")) {
          
          if (lowerValue.includes("midterm")) {
            type = "Midterm Exam";
            title = "Midterm Exam";
          } else if (lowerValue.includes("final")) {
            type = "Final Exam";
            title = "Final Exam";
          } else {
            type = "Exam";
            title = "Exam";
          }
          
        } else if (lowerValue.includes("project")) {
          type = "Project";
          
          // Try to extract project number
          const projMatch = lowerValue.match(/project\s*(?:#|\s)?(\d+)/i);
          const projNum = projMatch ? projMatch[1] : "";
          title = projNum ? `Project ${projNum}` : "Project";
          
        } else if (lowerValue.includes("quiz")) {
          type = "Quiz";
          
          // Try to extract quiz number
          const quizMatch = lowerValue.match(/quiz\s*(?:#|\s)?(\d+)/i);
          const quizNum = quizMatch ? quizMatch[1] : "";
          title = quizNum ? `Quiz ${quizNum}` : "Quiz";
        }
        
        return {
          title: title,
          dueDate: formatDate(rowDate),
          course: courseName,
          description: colValue,
          type: type
        };
      };
      
      // Check all columns for potential assignments
      let foundAssignment = false;
      
      // First, check columns with likely assignment content
      const assignmentColumnKeywords = [
        "hw", "homework", "p&c", "activity", "assignment", "project", 
        "exam", "quiz", "due", "task", "deliverable"
      ];
      
      // Check columns that have assignment-related names first
      for (const key in row) {
        const lowerKey = key.toLowerCase();
        
        // Skip date columns we already processed
        if (dateColumnCandidates.some(dc => lowerKey === dc.toLowerCase())) {
          continue;
        }
        
        // Check if column name contains assignment keywords
        if (assignmentColumnKeywords.some(keyword => lowerKey.includes(keyword))) {
          const assignment = extractAssignmentFromValue(row[key], key);
          if (assignment) {
            console.log(`Found assignment in column "${key}": ${assignment.title}`);
            assignments.push(assignment);
            foundAssignment = true;
          }
        }
      }
      
      // If we didn't find any assignments in the specific columns, 
      // check topic or content columns, which often contain embedded assignment info
      if (!foundAssignment) {
        const contentColumnKeywords = ["topic", "content", "description", "lecture", "session", "lab"];
        
        for (const key in row) {
          const lowerKey = key.toLowerCase();
          
          // Skip columns we already checked
          if (dateColumnCandidates.some(dc => lowerKey === dc.toLowerCase()) || 
              assignmentColumnKeywords.some(keyword => lowerKey.includes(keyword))) {
            continue;
          }
          
          // Check content columns
          if (contentColumnKeywords.some(keyword => lowerKey.includes(keyword))) {
            const value = row[key];
            
            if (value && typeof value === 'string') {
              const lowerValue = value.toLowerCase();
              
              // Only extract if it contains assignment keywords
              if (lowerValue.includes("homework") || lowerValue.includes("hw") ||
                 lowerValue.includes("assignment") || lowerValue.includes("project") ||
                 lowerValue.includes("exam") || lowerValue.includes("activity") ||
                 lowerValue.includes("due") || lowerValue.includes("p&c") ||
                 lowerValue.includes("quiz") || lowerValue.includes("test")) {
                
                const assignment = extractAssignmentFromValue(value, key);
                if (assignment) {
                  console.log(`Found assignment in content column "${key}": ${assignment.title}`);
                  assignments.push(assignment);
                  foundAssignment = true;
                }
              }
            }
          }
        }
      }
      
      // Last resort: check any other columns that might contain assignments
      if (!foundAssignment) {
        for (const key in row) {
          const lowerKey = key.toLowerCase();
          
          // Skip columns we already checked
          if (dateColumnCandidates.some(dc => lowerKey === dc.toLowerCase()) ||
              assignmentColumnKeywords.some(keyword => lowerKey.includes(keyword)) ||
              contentColumnKeywords.some(keyword => lowerKey.includes(keyword))) {
            continue;
          }
          
          const value = row[key];
          
          if (value && typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            
            // Look for assignment-related keywords
            if (lowerValue.includes("homework") || lowerValue.includes("hw") ||
               lowerValue.includes("assignment") || lowerValue.includes("project") ||
               lowerValue.includes("due") || lowerValue.includes("submit")) {
              
              const assignment = extractAssignmentFromValue(value, key);
              if (assignment) {
                console.log(`Found assignment in other column "${key}": ${assignment.title}`);
                assignments.push(assignment);
                foundAssignment = true;
              }
            }
          }
        }
      }
    });

    console.log(`Extracted ${assignments.length} assignments from timeline`);
    
    // Return array of basic assignment objects (no workbook references)
    return assignments.map(item => ({
      title: String(item.title || ""),
      dueDate: String(item.dueDate || ""),
      course: String(item.course || ""),
      description: String(item.description || ""),
      type: String(item.type || "Assignment"),
    }));
    
  } catch (error) {
    console.error("Error parsing timeline data:", error);
    return [];
  }
}