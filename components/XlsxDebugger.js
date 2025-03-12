// components/XlsxDebugger.js
"use client";

import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';

const XlsxDebugger = () => {
  const [fileInfo, setFileInfo] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(null);
  const [sampleRows, setSampleRows] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellStyles: true,
          cellFormula: true,
          dateNF: 'yyyy-mm-dd',
          cellNF: true,
        });

        setFileInfo({
          name: file.name,
          size: file.size,
          type: file.type,
          sheets: workbook.SheetNames,
          workbook
        });

        if (workbook.SheetNames.length > 0) {
          const firstSheet = workbook.SheetNames[0];
          setSelectedSheet(firstSheet);
          loadSheetData(workbook, firstSheet);
        }
      } catch (error) {
        console.error("Error reading Excel file:", error);
        alert(`Error reading file: ${error.message}`);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false
  });

  const loadSheetData = (workbook, sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    
    // Get data with headers
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (jsonData.length > 0) {
      setHeaderRow(jsonData[0]);
      setSampleRows(jsonData.slice(1, 6)); // Show up to 5 data rows
    } else {
      setHeaderRow([]);
      setSampleRows([]);
    }
  };

  const handleSheetChange = (e) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);
    loadSheetData(fileInfo.workbook, sheetName);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4">Excel File Structure Debugger</h2>
      
      {!fileInfo ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 hover:border-blue-400 dark:border-gray-700 dark:hover:border-blue-600'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-12 h-12 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v9a2 2 0 01-2 2h-1" 
              />
            </svg>
            {isDragActive ? (
              <p className="text-blue-500 font-medium">Drop Excel file here...</p>
            ) : (
              <div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">
                  Drag & drop an Excel file here, or click to select
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  This tool will help you understand the structure of your Excel file
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <h3 className="font-medium">{fileInfo.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(fileInfo.size / 1024).toFixed(1)} KB • {fileInfo.sheets.length} sheets
              </p>
            </div>
            <button 
              onClick={() => setFileInfo(null)}
              className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-md"
            >
              Reset
            </button>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
            <div className="mb-4">
              <label htmlFor="sheet-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Sheet:
              </label>
              <select
                id="sheet-selector"
                value={selectedSheet}
                onChange={handleSheetChange}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {fileInfo.sheets.map((sheet) => (
                  <option key={sheet} value={sheet}>{sheet}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Headers:</h4>
              {headerRow && headerRow.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 mt-2">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Index
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {headerRow.map((cell, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {index}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {cell !== undefined && cell !== null ? String(cell) : '(empty)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No headers found</p>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">Sample Rows:</h4>
              {sampleRows && sampleRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 mt-2">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Row
                        </th>
                        {headerRow && headerRow.map((header, index) => (
                          <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {header || `Column ${index}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sampleRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                            {rowIndex + 1}
                          </td>
                          {headerRow && headerRow.map((_, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                              {row[cellIndex] !== undefined && row[cellIndex] !== null 
                                ? String(row[cellIndex]) 
                                : '(empty)'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No data rows found</p>
              )}
            </div>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-800">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Tips for fixing your syllabus file:</h4>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc pl-5 space-y-1">
              <li>Make sure your file has clear header rows with column names like "Due Date", "Assignment", etc.</li>
              <li>If your file has multiple sheets, check that assignments are in the correct sheet</li>
              <li>Dates should be in a recognizable format (MM/DD/YYYY or similar)</li>
              <li>Look for columns containing keywords like "Homework", "Assignment", "Due", etc.</li>
              <li>If your sheet is formatted as a timeline/calendar, make sure it has date indicators</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default XlsxDebugger;