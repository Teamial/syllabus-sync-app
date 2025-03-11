// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Syllabus Sync Tool",
  description: "Upload course materials and export assignments to your favorite planning tool",
  applicationName: "Syllabus Sync Tool",
  authors: [{ name: "Syllabus Sync" }],
  keywords: ["syllabus", "assignments", "education", "planning", "power planner", "calendar"],
  creator: "Syllabus Sync",
  publisher: "Syllabus Sync",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  colorScheme: "dark light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
