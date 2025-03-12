// app/debug/page.js
"use client";

import React from 'react';
import XlsxDebugger from '../../components/XlsxDebugger';
import ClientOnly from '../../components/ClientOnly';

export default function DebugPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Syllabus File Debugger
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Upload your syllabus file to analyze its structure and see why it might not be working
          </p>
        </header>
        
        <ClientOnly>
          <XlsxDebugger />
        </ClientOnly>
        
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Common Format Issues</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">Issue 1: Missing Due Date Column</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                The most common issue is that the app can't find a column with due dates. 
                Due date columns should be clearly labeled as "Due Date", "Deadline", "Date", etc.
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
                <h4 className="font-medium text-sm">Solution:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Edit your Excel file to ensure it has a clearly labeled column for due dates.
                  Make sure dates are in a standard format like MM/DD/YYYY.
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg">Issue 2: Timeline Format Not Detected</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                If your syllabus is organized as a course timeline or calendar, it might not be recognized.
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
                <h4 className="font-medium text-sm">Solution:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Make sure your timeline has clear date columns and columns that contain assignment keywords
                  like "Homework", "Project", "Due", etc. If possible, convert your timeline to a table format
                  with explicit assignment and due date columns.
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg">Issue 3: No Assignments Found</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                The app might not recognize text as assignments without the right keywords.
              </p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
                <h4 className="font-medium text-sm">Solution:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Edit your file to clearly mark assignments with keywords like "Homework", "Assignment", 
                  "Project", etc. Make sure each assignment has a clear title and due date.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          <p>
            Return to <a href="/" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              Syllabus Sync Tool
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}