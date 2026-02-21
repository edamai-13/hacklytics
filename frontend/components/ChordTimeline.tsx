"use client";

import { useRef, useState } from "react";
import type { ChordSegment } from "@/lib/api";

const CHORD_COLORS: Record<string, string> = {
  C: "#ef4444", D: "#f97316", Dm: "#fb923c", E: "#eab308",
  Em: "#84cc16", F: "#22c55e", G: "#06b6d4", A: "#3b82f6",
  Am: "#8b5cf6", B7: "#ec4899",
};

function colorFor(chord: string): string {
  return CHORD_COLORS[chord] ?? "#6b7280";
}

interface Props {
  chords: ChordSegment[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onLoopSet: (region: [number, number]) => void;
}

export default function ChordTimeline({ chords, duration, currentTime, onSeek, onLoopSet }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [loopStart, setLoopStart] = useState<number | null>(null);

  function timeToPercent(t: number) {
    return (t / duration) * 100;
  }

  function clickToTime(e: React.MouseEvent<HTMLDivElement>) {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    return (x / rect.width) * duration;
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const t = clickToTime(e);
    if (t === undefined) return;

    if (loopStart === null) {
      setLoopStart(t);
    } else {
      const [a, b] = loopStart < t ? [loopStart, t] : [t, loopStart];
      onLoopSet([a, b]);
      setLoopStart(null);
    }
  }

  const playheadPct = timeToPercent(currentTime);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Chord timeline</span>
        <span>
          {loopStart !== null
            ? "Click a second point to set loop end"
            : "Click two points to set a loop region"}
        </span>
      </div>

      <div
        ref={barRef}
        onClick={handleClick}
        className="relative h-12 rounded-lg overflow-hidden cursor-pointer select-none"
        style={{ background: "#1a1a1a" }}
      >
        {chords.map((c, i) => (
          <div
            key={i}
            className="absolute top-0 h-full flex items-center justify-center text-xs font-bold text-white"
            style={{
              left: `${timeToPercent(c.start)}%`,
              width: `${timeToPercent(c.end - c.start)}%`,
              background: colorFor(c.chord),
              opacity: currentTime >= c.start && currentTime < c.end ? 1 : 0.65,
              transition: "opacity 0.15s",
            }}
          >
            {c.chord}
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white z-10 pointer-events-none"
          style={{ left: `${playheadPct}%`, transition: "left 0.1s linear" }}
        />

        {/* Loop start marker */}
        {loopStart !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-yellow-400 z-10 pointer-events-none"
            style={{ left: `${timeToPercent(loopStart)}%` }}
          />
        )}
      </div>

      {/* Chord legend */}
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set(chords.map((c) => c.chord))).map((chord) => (
          <span
            key={chord}
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: colorFor(chord), color: "#fff" }}
          >
            {chord}
          </span>
        ))}
      </div>
    </div>
  );
}
