// components/HelpSection.js
import React, { useState } from "react";

const HelpSection = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Help & FAQs
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium focus:outline-none"
        >
          {isOpen ? "Hide Help" : "Show Help"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 text-gray-700 dark:text-gray-300">
          <div>
            <h3 className="font-medium text-lg mb-2">Supported File Formats</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Excel files (.xlsx, .xls) - Both standard and course timeline
                formats
              </li>
              <li>CSV files (.csv) - With headers for assignments</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-lg mb-2">
              Tips for Better Results
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                For Excel files with course schedules, make sure date columns
                are properly formatted
              </li>
              <li>
                Files with clear headers (Date, Assignment, Due Date, etc.) work
                best
              </li>
              <li>
                Include the course name in the filename (e.g.,
                "CS101_Schedule.xlsx")
              </li>
              <li>Past assignments are automatically filtered out</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-lg mb-2">Export Options</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium">Power Planner</span>: Exports in a
                format compatible with the Power Planner app
              </li>
              <li>
                <span className="font-medium">Calendar (ICS)</span>: Exports as
                an .ics file that can be imported to Google Calendar, Outlook,
                etc.
              </li>
              <li>
                <span className="font-medium">CSV</span>: Exports as a generic
                CSV file for use in any spreadsheet application
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-lg mb-2">Troubleshooting</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                If no assignments are found, try checking your file format
              </li>
              <li>
                Make sure date columns in your file are properly formatted as
                dates
              </li>
              <li>
                For complex formats, try using our template or formatting your
                syllabus as a table first
              </li>
              <li>
                For course timelines, make sure column headers include "Date",
                "Week", and assignment types
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSection;
