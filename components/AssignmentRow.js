"use client";
import React from "react";

const AssignmentRow = ({ assignment }) => {
  // Safeguard against invalid assignment object
  if (
    !assignment ||
    typeof assignment !== "object" ||
    Array.isArray(assignment)
  ) {
    console.warn("Invalid assignment passed to AssignmentRow:", assignment);
    return null;
  }

  // Detect XLSX workbook object and prevent rendering it
  if (
    assignment.SheetNames ||
    assignment.Sheets ||
    assignment.Workbook ||
    assignment.Props ||
    assignment.Deps ||
    assignment.SSF ||
    assignment.Strings ||
    assignment.Styles ||
    assignment.Themes ||
    assignment.Directory ||
    assignment.Custprops
  ) {
    console.error(
      "XLSX workbook object passed to AssignmentRow, skipping render",
    );
    return null;
  }

  // Destructure with defaults to avoid undefined errors
  const {
    title = "Unnamed Assignment",
    dueDate = "",
    course = "",
    description = "",
    type = "Assignment",
  } = assignment;

  // Determine badge color based on assignment type
  const getBadgeClass = (type) => {
    const typeColors = {
      Homework: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "P&C Activity":
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      Project:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      Exam: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "Midterm Exam":
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "Final Exam": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      Quiz: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };

    return (
      typeColors[type] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
    );
  };

  // Format the due date for display
  const formatDisplayDate = (dateStr) => {
    try {
      if (!dateStr) return "No date";

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      // Get day name
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = dayNames[date.getDay()];

      // Format as "Tue, 3/11/2025"
      return `${dayName}, ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    } catch (e) {
      console.warn("Error formatting date:", e);
      return dateStr || "Invalid date";
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (dateStr) => {
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
      console.warn("Error calculating days remaining:", e);
      return null;
    }
  };

  // Get text for days remaining
  const getDaysRemainingText = (dateStr) => {
    const days = getDaysRemaining(dateStr);
    if (days === null) return "";

    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days < 0) return `Overdue by ${Math.abs(days)} days`;
    return `Due in ${days} days`;
  };

  // Get class for days remaining
  const getDaysRemainingClass = (dateStr) => {
    const days = getDaysRemaining(dateStr);
    if (days === null) return "";

    if (days < 0) return "text-red-600 dark:text-red-400";
    if (days <= 1) return "text-orange-600 dark:text-orange-400";
    if (days <= 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  // Truncate text if too long
  const truncateText = (text, maxLength = 120) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title || "Unnamed Assignment"}
        </div>
        {description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate mt-1">
            {truncateText(description)}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {formatDisplayDate(dueDate)}
        </div>
        <div className={`text-xs ${getDaysRemainingClass(dueDate)} mt-1`}>
          {getDaysRemainingText(dueDate)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {course || "No course"}
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeClass(type)}`}
        >
          {type || "Assignment"}
        </span>
      </td>
    </tr>
  );
};

export default AssignmentRow;
