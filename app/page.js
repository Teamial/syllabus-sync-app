// app/page.js
"use client";

import SyllabusSyncApp from "../components/SyllabusSyncApp";
import ClientOnly from "../components/ClientOnly";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <ClientOnly>
        <SyllabusSyncApp />
      </ClientOnly>
    </main>
  );
}
