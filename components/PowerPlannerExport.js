"use client";
import React, { useState } from "react";
import Papa from "papaparse";

const PowerPlannerExport = ({
  assignments,
  onExport,
  courseOverride = "",
  setCourseOverride,
}) => {
  const [exportStatus, setExportStatus] = useState("");

  // Handle export
  const handleExport = () => {
    if (!assignments || assignments.length === 0) {
      setExportStatus("No assignments to export");
      return;
    }

    try {
      // Format data for Power Planner
      const formattedData = assignments.map((item) => ({
        Name: item.title || "Unnamed Assignment",
        Class: courseOverride || item.course || "Unknown Course",
        DueDate: item.dueDate || "",
        Details: item.description || "",
        Type: mapAssignmentType(item.type) || "Assignment",
      }));

      // Generate CSV
      const csv = Papa.unparse(formattedData);

      // Download the file
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "power_planner_import.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success message
      setExportStatus("Export successful!");
      setTimeout(() => setExportStatus(""), 3000);

      // Call parent callback if provided
      if (onExport) {
        onExport(formattedData);
      }
    } catch (err) {
      console.error("Export error:", err);
      setExportStatus(`Export failed: ${err.message}`);
    }
  };

  // Map assignment types to Power Planner compatible types
  const mapAssignmentType = (type) => {
    if (!type) return "Assignment";

    // Power Planner supports these assignment types
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

    return typeMap[type] || type;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4">Export to Power Planner</h2>

      <div className="mb-4">
        <label
          htmlFor="course-override"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Override Course Name (Optional)
        </label>
        <input
          id="course-override"
          type="text"
          value={courseOverride}
          onChange={(e) => setCourseOverride(e.target.value)}
          placeholder="e.g. CMP 158"
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave empty to use original course names from the file
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-4">
        <button
          onClick={handleExport}
          disabled={assignments.length === 0}
          className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white
            ${
              assignments.length === 0
                ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            }`}
        >
          Export to Power Planner
        </button>

        {exportStatus && (
          <div
            className={`text-sm px-3 py-2 rounded-md ${
              exportStatus.includes("failed") ||
              exportStatus.includes("No assignments")
                ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
            }`}
          >
            {exportStatus}
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        <h3 className="font-medium mb-2">Power Planner Import Instructions:</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Export the file using the button above</li>
          <li>Open the Power Planner app on your device</li>
          <li>Go to Settings &gt; Import Data</li>
          <li>Select the exported CSV file</li>
          <li>Review the imported assignments and confirm</li>
        </ol>
      </div>
    </div>
  );
};

export default PowerPlannerExport;
