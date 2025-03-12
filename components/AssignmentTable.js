"use client";

import React, { useState, useMemo } from "react";
import AssignmentRow from "./AssignmentRow";

const AssignmentTable = ({ assignments }) => {
  const [sortConfig, setSortConfig] = useState({
    key: "dueDate",
    direction: "ascending",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Apply sorting and filtering
  const sortedAssignments = useMemo(() => {
    if (!assignments || assignments.length === 0) return [];

    let sortableItems = [...assignments];

    // Filter items if search term exists
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(
        (item) =>
          (item.title && item.title.toLowerCase().includes(lowerSearchTerm)) ||
          (item.course &&
            item.course.toLowerCase().includes(lowerSearchTerm)) ||
          (item.type && item.type.toLowerCase().includes(lowerSearchTerm)) ||
          (item.description &&
            item.description.toLowerCase().includes(lowerSearchTerm)),
      );
    }

    // Sort items
    sortableItems.sort((a, b) => {
      // Handle missing values
      if (a[sortConfig.key] === undefined) return 1;
      if (b[sortConfig.key] === undefined) return -1;

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Special handling for dates
      if (sortConfig.key === "dueDate") {
        // Try to parse dates - default to string comparison if parsing fails
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);

        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortConfig.direction === "ascending"
            ? aDate - bDate
            : bDate - aDate;
        }
      }

      // String comparison for other fields
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "ascending"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Fallback for other types
      return sortConfig.direction === "ascending"
        ? aValue > bValue
          ? 1
          : -1
        : aValue < bValue
          ? 1
          : -1;
    });

    return sortableItems;
  }, [assignments, sortConfig, searchTerm]);

  const requestSort = (key) => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        return {
          key,
          direction:
            prevConfig.direction === "ascending" ? "descending" : "ascending",
        };
      }
      return { key, direction: "ascending" };
    });
  };

  const getSortDirectionIcon = (name) => {
    if (sortConfig.key !== name) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 10L12 14L16 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return sortConfig.direction === "ascending" ? (
      <svg
        className="w-4 h-4 text-blue-500"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 14L12 10L16 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-blue-500"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 10L12 14L16 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (!assignments || assignments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          No assignments to display. Upload some files to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Extracted Assignments
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({sortedAssignments.length} items)
          </span>
        </h3>

        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assignments..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort("title")}
              >
                <div className="flex items-center space-x-1">
                  <span>Title</span>
                  {getSortDirectionIcon("title")}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort("dueDate")}
              >
                <div className="flex items-center space-x-1">
                  <span>Due Date</span>
                  {getSortDirectionIcon("dueDate")}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort("course")}
              >
                <div className="flex items-center space-x-1">
                  <span>Course</span>
                  {getSortDirectionIcon("course")}
                </div>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hidden md:table-cell"
                onClick={() => requestSort("type")}
              >
                <div className="flex items-center space-x-1">
                  <span>Type</span>
                  {getSortDirectionIcon("type")}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedAssignments.map((item, index) => (
              <AssignmentRow key={index} assignment={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssignmentTable;
