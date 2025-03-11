# Syllabus Sync Tool

A modern web application that extracts assignment data from various syllabus file formats and exports it to planning tools like Power Planner, calendar applications, and more.

![Syllabus Sync Tool](https://raw.githubusercontent.com/your-username/syllabus-sync-app/main/public/screenshot.png)

## Features

- **Multiple File Format Support**: Upload and process Excel sheets (.xlsx, .xls), CSV files, and basic support for PDF and Word documents.
- **Intelligent Data Extraction**: Automatically detects assignment details using column name variants.
- **Course Name Detection**: Smart extraction of course codes from filenames.
- **Sortable Results**: View and sort extracted assignments by title, due date, course, and type.
- **Search Functionality**: Quickly filter assignments to find what you need.
- **Multiple Export Options**:
  - Power Planner format for easy import into the Power Planner app
  - ICS calendar format for import into calendar applications
  - CSV format for general spreadsheet compatibility

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/syllabus-sync-app.git
   cd syllabus-sync-app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. **Upload Files**: Drag and drop your syllabus files (Excel, CSV, PDF, or Word) onto the upload area or click to select files.
2. **Extract Assignments**: Click the "Extract Assignments" button to process your files.
3. **Review Results**: Check the extracted assignments in the table. You can search and sort as needed.
4. **Export Data**: Select your preferred export format and click "Export Data" to download the file.
5. **Import to Planning Tool**: Import the exported file into your planning tool of choice (Power Planner, Google Calendar, etc.).

## Deployment

This project is ready to deploy on Vercel:

1. Push your code to a GitHub repository.
2. Connect your repository to Vercel.
3. Vercel will automatically detect the Next.js project and configure the build settings.
4. Deploy!

Alternatively, to deploy manually:

```bash
npm run build
# or
vercel deploy
```

## Technology Stack

- **Frontend**: React, Next.js
- **UI Components**: Custom components with Tailwind CSS
- **File Processing**: xlsx for Excel, papaparse for CSV
- **Styling**: Tailwind CSS

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Next.js team for the amazing framework
- Tailwind CSS for the styling utilities
- XLSX and Papa Parse for file processing capabilities
