"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  audioUrl: string;
  onTimeUpdate: (time: number) => void;
  playbackRate: number;
  loopRegion: [number, number] | null;
}

export default function WavePlayer({ audioUrl, onTimeUpdate, playbackRate, loopRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let ws: any;
    let intervalId: ReturnType<typeof setInterval>;

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      ws = WaveSurfer.create({
        container: containerRef.current!,
        waveColor: "#404040",
        progressColor: "#3b82f6",
        cursorColor: "#60a5fa",
        height: 80,
        normalize: true,
        backend: "WebAudio",
      });

      ws.load(audioUrl);

      ws.on("ready", () => setReady(true));
      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
      ws.on("error", () => setError("Could not load audio"));

      // Poll currentTime every 100ms — reliable fallback per CLAUDE.md
      intervalId = setInterval(() => {
        if (ws && ws.isPlaying()) {
          onTimeUpdate(ws.getCurrentTime());
        }
      }, 100);

      wavesurferRef.current = ws;
    });

    return () => {
      clearInterval(intervalId);
      ws?.destroy();
    };
  }, [audioUrl]);

  useEffect(() => {
    wavesurferRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  // Basic loop enforcement via polling
  useEffect(() => {
    if (!loopRegion || !wavesurferRef.current) return;
    const [start, end] = loopRegion;
    const id = setInterval(() => {
      const ws = wavesurferRef.current;
      if (!ws || !ws.isPlaying()) return;
      const t = ws.getCurrentTime();
      if (t >= end) ws.seekTo(start / ws.getDuration());
    }, 50);
    return () => clearInterval(id);
  }, [loopRegion]);

  function togglePlay() {
    wavesurferRef.current?.playPause();
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-neutral-900 p-4 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
      <div ref={containerRef} className="w-full" />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!ready}
          className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-sm hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {playing ? "Pause" : "Play"}
        </button>
        {!ready && (
          <span className="text-sm text-neutral-500">Loading audio…</span>
        )}
      </div>
    </div>
  );
}
