"use client";

import React from "react";

const ExportOptions = ({
  exportFormat,
  setExportFormat,
  onExport,
  disabled,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Export Options
      </h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          disabled={disabled}
        >
          <option value="powerplanner">Power Planner</option>
          <option value="ics">Calendar (ICS)</option>
          <option value="csv">CSV</option>
        </select>

        <button
          onClick={onExport}
          disabled={disabled}
          className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white transition-colors
            ${
              disabled
                ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            }`}
        >
          Export Data
        </button>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        {exportFormat === "powerplanner" &&
          "Exports in Power Planner format for easy import into the Power Planner app"}
        {exportFormat === "ics" &&
          "Exports as an ICS file that can be imported into most calendar applications"}
        {exportFormat === "csv" &&
          "Exports as a generic CSV file that can be opened in spreadsheet applications"}
      </div>
    </div>
  );
};

export default ExportOptions;
