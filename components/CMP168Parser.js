// components/CMP168Parser.js
// A specialized parser for the CMP168_Timeline.xlsx format

import * as XLSX from 'xlsx';
import { parseDate, formatDate, isDateInPast } from './DateUtils';

/**
 * Specialized parser for CMP168 timeline format
 * @param {Object} workbook - XLSX workbook object 
 * @returns {Array} - Array of extracted assignments
 */
export function parseCMP168Timeline(workbook) {
  if (!workbook || !workbook.SheetNames || !workbook.Sheets) {
    console.warn("Invalid workbook structure");
    return [];
  }

  console.log(`Processing CMP168 Timeline with ${workbook.SheetNames.length} sheets`);
  const assignments = [];
  const courseName = "CMP 168"; // Default course name

  // Process each sheet in the workbook
  for (const sheetName of workbook.SheetNames) {
    try {
      console.log(`Processing sheet: ${sheetName}`);
      const sheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      
      if (!jsonData || jsonData.length === 0) {
        console.log(`Sheet ${sheetName} is empty, skipping`);
        continue;
      }
      
      console.log(`Sheet ${sheetName} has ${jsonData.length} rows`);
      
      // Log the keys from the first row to understand the structure
      if (jsonData.length > 0) {
        console.log("Column headers:", Object.keys(jsonData[0]));
      }
      
      // Process each row in the sheet
      for (const row of jsonData) {
        // Skip if not a valid row
        if (!row || typeof row !== 'object') continue;
        
        // Get the date value (required for all assignments)
        const dateValue = row.Date;
        if (!dateValue) {
          console.log("No date value in row, skipping");
          continue;
        }
        
        // Parse the date
        const currentYear = new Date().getFullYear();
        const rowDate = parseDate(dateValue, currentYear);
        
        // Skip invalid dates or dates in the past
        if (!rowDate) {
          console.log(`Invalid date: ${dateValue}`);
          continue;
        }
        
        if (isDateInPast(rowDate)) {
          console.log(`Skipping past date: ${formatDate(rowDate)}`);
          continue;
        }
        
        const formattedDate = formatDate(rowDate);
        console.log(`Processing date: ${formattedDate}`);

        // 1. Check for Homework assignments
        if (row['HW Due By 11:59 PM On Specified Date']) {
          // This is a homework assignment
          console.log(`Found homework due on ${formattedDate}`);
          
          // Extract homework number if available
          let hwTitle = "Homework";
          let description = "";
          
          // Look for homework details in Lecture Topic column
          if (row['Lecture Topic T,Th']) {
            description = row['Lecture Topic T,Th'];
            // Try to extract homework number
            const hwMatch = description.match(/HW\s*(\d+)/i);
            if (hwMatch) {
              hwTitle = `Homework ${hwMatch[1]}`;
            }
          }
          
          assignments.push({
            title: hwTitle,
            dueDate: formattedDate,
            course: courseName,
            description: description,
            type: "Homework"
          });
        }
        
        // 2. Check for P&C Activities
        if (row['P&C Due By 11:59 PM On Specified Date']) {
          // This is a P&C activity
          console.log(`Found P&C activity due on ${formattedDate}`);
          
          // Extract activity number if available
          let activityTitle = "P&C Activity";
          let description = "";
          
          // Look for activity details in Lecture Topic column
          if (row['Lecture Topic T,Th']) {
            description = row['Lecture Topic T,Th'];
            // Try to extract activity number
            const actMatch = description.match(/P&C\s*Activity\s*(\d+)/i);
            if (actMatch) {
              activityTitle = `P&C Activity ${actMatch[1]}`;
            }
          }
          
          // Also check for P&C Activity in the specified date cell
          if (row['P&C Due By 11:59 PM On Specified Date'] !== true && 
              typeof row['P&C Due By 11:59 PM On Specified Date'] === 'string') {
            const cellText = row['P&C Due By 11:59 PM On Specified Date'];
            const actMatch = cellText.match(/Activity\s*(\d+)/i);
            if (actMatch) {
              activityTitle = `P&C Activity ${actMatch[1]}`;
            }
            if (description) {
              description += ` - ${cellText}`;
            } else {
              description = cellText;
            }
          }
          
          assignments.push({
            title: activityTitle,
            dueDate: formattedDate,
            course: courseName,
            description: description,
            type: "P&C Activity"
          });
        }
        
        // 3. Check for projects in the Lab Session Topic column
        if (row['Lab Session Topic'] && 
            String(row['Lab Session Topic']).includes('PROJECT')) {
          console.log(`Found project in Lab Session column: ${row['Lab Session Topic']}`);
          
          const labText = String(row['Lab Session Topic']);
          
          // Extract project number if available
          let projectTitle = "Project";
          const projMatch = labText.match(/PROJECT\s*(\d+)/i);
          if (projMatch) {
            projectTitle = `Project ${projMatch[1]}`;
          }
          
          assignments.push({
            title: projectTitle,
            dueDate: formattedDate,
            course: courseName,
            description: labText,
            type: "Project"
          });
        }
        
        // 4. Check for exams in any column
        const rowValues = Object.values(row).join(' ').toLowerCase();
        if (rowValues.includes('exam') || rowValues.includes('midterm') || rowValues.includes('final')) {
          console.log(`Found possible exam in row for date ${formattedDate}`);
          
          let examTitle = "Exam";
          
          if (rowValues.includes('midterm')) {
            examTitle = "Midterm Exam";
          } else if (rowValues.includes('final')) {
            examTitle = "Final Exam";
          }
          
          // Extract description
          let description = "";
          if (row['Lecture Topic T,Th']) {
            description = row['Lecture Topic T,Th'];
          } else if (row['Lab Session Topic']) {
            description = row['Lab Session Topic'];
          }
          
          assignments.push({
            title: examTitle,
            dueDate: formattedDate,
            course: courseName,
            description: description,
            type: "Exam"
          });
        }
        
        // 5. Check for special PROJECT entries in Lab Session Topic
        // These seem to be specially formatted in your sheet with "PROJECT 1"
        const labSessionTopic = row['Lab Session Topic'];
        if (labSessionTopic && typeof labSessionTopic === 'string') {
          // Check for project continued entries
          if (labSessionTopic.includes('Project 1 Continued')) {
            console.log(`Found Project Continued in Lab Session column: ${labSessionTopic}`);
            
            assignments.push({
              title: "Project 1 Continued",
              dueDate: formattedDate,
              course: courseName,
              description: labSessionTopic,
              type: "Project"
            });
          }
          // Check for "PROJECT 1 DUE" entries
          else if (labSessionTopic.includes('PROJECT 1 DUE')) {
            console.log(`Found PROJECT DUE in Lab Session column: ${labSessionTopic}`);
            
            assignments.push({
              title: "Project 1",
              dueDate: formattedDate,
              course: courseName,
              description: `${labSessionTopic} - Due Date`,
              type: "Project"
            });
          }
          // Check for "File I/O & Exceptions" which appears to be related to projects
          else if (labSessionTopic.includes('File I/O & Exceptions')) {
            console.log(`Found File I/O & Exceptions in Lab Session column: ${labSessionTopic}`);
            
            assignments.push({
              title: "File I/O & Exceptions Assignment",
              dueDate: formattedDate,
              course: courseName,
              description: labSessionTopic,
              type: "Assignment"
            });
          }
        }
        
        // 6. Check for exam review assignments
        if (row['Lab #'] && row['Lab Session Topic'] && 
            String(row['Lab Session Topic']).includes('Exam Review')) {
          console.log(`Found exam review: ${row['Lab Session Topic']}`);
          
          assignments.push({
            title: "Exam Review",
            dueDate: formattedDate,
            course: courseName,
            description: row['Lab Session Topic'],
            type: "Assignment"
          });
        }
      }
    } catch (error) {
      console.error(`Error processing sheet ${sheetName}:`, error);
    }
  }
  
  console.log(`Total assignments found: ${assignments.length}`);
  
  // Ensure we return simple objects without any reference to the workbook
  return assignments.map(item => ({
    title: String(item.title || ""),
    dueDate: String(item.dueDate || ""),
    course: String(item.course || ""),
    description: String(item.description || ""),
    type: String(item.type || "Assignment")
  }));
}