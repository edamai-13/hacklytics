"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAudio, loadDemo } from "@/lib/api";

const DEMOS = [
  { slug: "demo-1", label: "Let It Be", artist: "The Beatles" },
  { slug: "demo-2", label: "Horse With No Name", artist: "America" },
  { slug: "demo-3", label: "Riptide", artist: "Vance Joy" },
];

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { job_id } = await uploadAudio(file);
      router.push(`/results/${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  async function handleDemo(slug: string) {
    router.push(`/results/${slug}?demo=true`);
  }

  return (
    <div className="space-y-12">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Learn any song on guitar</h1>
        <p className="text-neutral-400 text-lg max-w-xl mx-auto">
          Upload an MP3 and ChordCoach extracts the chord progression, shows you
          finger positions, and lets you practice at your own pace.
        </p>
      </div>

      {/* Demo songs */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
          Try a demo song
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DEMOS.map((d) => (
            <button
              key={d.slug}
              onClick={() => handleDemo(d.slug)}
              className="flex flex-col items-start gap-1 rounded-xl border border-neutral-700 bg-neutral-900 px-5 py-4 text-left hover:border-neutral-500 hover:bg-neutral-800 transition-colors"
            >
              <span className="font-semibold">{d.label}</span>
              <span className="text-sm text-neutral-400">{d.artist}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
          Or upload your own
        </h2>
        <form
          onSubmit={handleUpload}
          className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 space-y-4"
        >
          <div
            className="border-2 border-dashed border-neutral-700 rounded-lg p-8 text-center cursor-pointer hover:border-neutral-500 transition-colors"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".mp3,.mp4"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-neutral-400">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-neutral-300">Drop an MP3 or MP4 here</p>
                <p className="text-sm text-neutral-500">≤ 90 seconds, ≤ 20 MB</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading…" : "Analyze chords"}
          </button>
        </form>
      </div>
    </div>
  );
}
