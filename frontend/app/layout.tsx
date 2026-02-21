import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChordCoach",
  description: "Extract chord progressions from audio and learn guitar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <span className="text-2xl">🎸</span>
            <span className="text-xl font-bold tracking-tight">ChordCoach</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
