// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Syllabus Sync App",
  description: "Upload syllabi and export to Power Planner",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
