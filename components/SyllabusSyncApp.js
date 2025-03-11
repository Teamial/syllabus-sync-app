import React, { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "sheetjs";

const SyllabusSyncApp = () => {
  const [files, setFiles] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState("powerplanner");

  const handleFileUpload = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles([...files, ...newFiles]);
  };

  const processFiles = async () => {
    setIsProcessing(true);
    const results = [];

    for (const file of files) {
      try {
        const fileType = file.name.split(".").pop().toLowerCase();
        let data = [];

        if (fileType === "xlsx" || fileType === "xls") {
          data = await processExcelFile(file);
        } else if (fileType === "csv") {
          data = await processCSVFile(file);
        } else if (fileType === "pdf") {
          // In a real implementation, this would use a PDF parsing library
          data = [
            {
              fileName: file.name,
              message: "PDF parsing would be implemented here",
            },
          ];
        } else if (fileType === "docx" || fileType === "doc") {
          // In a real implementation, this would use a DOCX parsing library
          data = [
            {
              fileName: file.name,
              message: "DOCX parsing would be implemented here",
            },
          ];
        }

        results.push(...data);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        results.push({ fileName: file.name, error: error.message });
      }
    }

    setExtractedData(results);
    setIsProcessing(false);
  };

  const processExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });

          // Get all sheets for processing
          const assignments = [];

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Check if this looks like an assignments sheet
            if (jsonData.length > 0) {
              // Extract course name from file name or sheet name
              const courseName = extractCourseName(file.name) || sheetName;

              // Process for assignments with better column detection
              const sheetAssignments = jsonData.map((row) => {
                // Find column names using multiple possible keys
                const title =
                  findValueByPossibleKeys(row, [
                    "Assignment",
                    "Title",
                    "Task",
                    "Name",
                    "Assignment Name",
                    "Description",
                  ]) || "Unnamed Assignment";

                const dueDate = findValueByPossibleKeys(row, [
                  "Due",
                  "Due Date",
                  "Deadline",
                  "Date",
                  "Due date",
                  "DueDate",
                ]);

                const description =
                  findValueByPossibleKeys(row, [
                    "Description",
                    "Details",
                    "Notes",
                    "Instructions",
                  ]) || "";

                const type =
                  findValueByPossibleKeys(row, [
                    "Type",
                    "Category",
                    "Assignment Type",
                  ]) || "Assignment";

                return {
                  title,
                  dueDate: dueDate || "No date specified",
                  course: courseName,
                  description,
                  type,
                  fileName: file.name,
                };
              });

              assignments.push(...sheetAssignments);
            }
          });

          resolve(assignments);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper functions for better data extraction
  const findValueByPossibleKeys = (obj, keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined) {
        return obj[key];
      }
    }
    return null;
  };

  const extractCourseName = (fileName) => {
    // Remove extension
    const nameWithoutExt = fileName.split(".")[0];

    // Try to extract course code patterns (e.g., CS101, MATH 240, etc.)
    const courseCodeMatch = nameWithoutExt.match(/([A-Z]{2,4})\s*(\d{3,4})/i);
    if (courseCodeMatch) {
      return courseCodeMatch[0];
    }

    // Fall back to the file name without extension
    return nameWithoutExt;
  };

  const processCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const assignments = results.data.map((row) => {
            return {
              title:
                row.Assignment || row.Title || row.Task || "Unnamed Assignment",
              dueDate:
                row.Due ||
                row["Due Date"] ||
                row.Deadline ||
                "No date specified",
              course: row.Course || row.Class || file.name.split(".")[0],
              description: row.Description || row.Details || "",
              type: row.Type || "Assignment",
              fileName: file.name,
            };
          });
          resolve(assignments);
        },
        error: (error) => reject(error),
      });
    });
  };

  const exportToPowerPlanner = () => {
    // Format data according to Power Planner's CSV import format
    const powerPlannerFormat = extractedData.map((item) => ({
      Name: item.title,
      Class: item.course,
      DueDate: formatDateForPowerPlanner(item.dueDate),
      Details: item.description,
      Type: item.type || "Assignment",
    }));

    // Convert to CSV
    const csv = Papa.unparse(powerPlannerFormat);

    // Create download link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "power_planner_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to format dates into Power Planner's expected format
  const formatDateForPowerPlanner = (dateString) => {
    try {
      // Handle various date formats
      let date;
      if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        // MM/DD/YYYY format
        date = new Date(dateString);
      } else if (dateString.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        // YYYY-MM-DD format
        date = new Date(dateString);
      } else {
        // Try to parse other formats or return as is if can't parse
        date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return dateString;
        }
      }

      // Format as MM/DD/YYYY which Power Planner accepts
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString;
    }
  };

  const exportToICS = () => {
    alert("This would export to ICS calendar format in a real implementation");
    // ICS calendar generation would be implemented here
  };

  return (
    <div className="flex flex-col p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        Syllabus & Assignment Sync Tool
      </h1>

      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Upload Files</h2>
        <p className="text-sm text-gray-600 mb-4">
          Upload Excel spreadsheets, CSV files, or syllabus documents (PDF,
          DOCX)
        </p>

        <div className="flex flex-col gap-4">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="border p-2 rounded"
            accept=".xlsx,.xls,.csv,.pdf,.docx,.doc"
          />

          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="bg-white p-2 rounded flex items-center"
              >
                <span className="text-sm">{file.name}</span>
                <button
                  className="ml-2 text-red-500"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={processFiles}
            disabled={files.length === 0 || isProcessing}
            className="bg-blue-500 text-white p-2 rounded disabled:bg-gray-300"
          >
            {isProcessing ? "Processing..." : "Extract Assignments"}
          </button>
        </div>
      </div>

      {extractedData.length > 0 && (
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">Extracted Assignments</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Due Date</th>
                  <th className="p-2 text-left">Course</th>
                  <th className="p-2 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {extractedData.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{item.title}</td>
                    <td className="p-2">{item.dueDate}</td>
                    <td className="p-2">{item.course}</td>
                    <td className="p-2">{item.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">Export Options</h3>
            <div className="flex gap-4">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="powerplanner">Power Planner</option>
                <option value="ics">Calendar (ICS)</option>
                <option value="csv">CSV</option>
              </select>

              <button
                onClick={
                  exportFormat === "powerplanner"
                    ? exportToPowerPlanner
                    : exportToICS
                }
                className="bg-green-500 text-white p-2 rounded"
              >
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        <h3 className="font-semibold mb-1">How to use:</h3>
        <ol className="list-decimal pl-5">
          <li>Upload your Excel spreadsheets, CSVs, or syllabus documents</li>
          <li>Extract assignment information</li>
          <li>Review the extracted assignments</li>
          <li>Export to Power Planner format</li>
          <li>Import the exported file into Power Planner</li>
        </ol>
      </div>
    </div>
  );
};

export default SyllabusSyncApp;
