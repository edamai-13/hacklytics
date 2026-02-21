"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { pollStatus, getResults, getDemoResults, type ChordResult } from "@/lib/api";
import WavePlayer from "@/components/WavePlayer";
import ChordTimeline from "@/components/ChordTimeline";
import Fretboard from "@/components/Fretboard";
import PracticeControls from "@/components/PracticeControls";

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [status, setStatus] = useState<"loading" | "processing" | "done" | "error">("loading");
  const [result, setResult] = useState<ChordResult | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopRegion, setLoopRegion] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentChordIndex = result
    ? result.chords.findIndex(
        (c) => currentTime >= c.start && currentTime < c.end
      )
    : -1;
  const currentChord = currentChordIndex >= 0 ? result!.chords[currentChordIndex] : null;
  const nextChord = currentChordIndex >= 0 ? result!.chords[currentChordIndex + 1] ?? null : null;

  const loadResult = useCallback(async () => {
    try {
      if (isDemo) {
        const data = await getDemoResults(id);
        setResult(data);
        setStatus("done");
        return;
      }

      const poll = async () => {
        const s = await pollStatus(id);
        if (s.status === "done") {
          const data = await getResults(id);
          setResult(data);
          setStatus("done");
        } else if (s.status === "error") {
          setError(s.error_message ?? "Analysis failed");
          setStatus("error");
        } else {
          setStatus("processing");
          setTimeout(poll, 1500);
        }
      };
      await poll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }, [id, isDemo]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  const audioUrl = isDemo
    ? `/api/demo/${id}/audio`
    : `/api/audio/${id}`;

  if (status === "loading" || status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-400">
          {status === "loading" ? "Loading…" : "Analyzing chords…"}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-red-400 text-lg font-semibold">Error</p>
        <p className="text-neutral-400">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{result.song_name}</h1>
        <p className="text-neutral-400 text-sm mt-1">
          {result.chords.length} chords · {Math.round(result.duration_sec)}s ·{" "}
          {result.bpm_estimate} BPM
        </p>
      </div>

      <WavePlayer
        audioUrl={audioUrl}
        onTimeUpdate={setCurrentTime}
        playbackRate={playbackRate}
        loopRegion={loopRegion}
      />

      <ChordTimeline
        chords={result.chords}
        duration={result.duration_sec}
        currentTime={currentTime}
        onSeek={() => {}}
        onLoopSet={setLoopRegion}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Fretboard
          currentChord={currentChord?.chord ?? null}
          nextChord={nextChord?.chord ?? null}
        />
        <PracticeControls
          playbackRate={playbackRate}
          onRateChange={setPlaybackRate}
          loopRegion={loopRegion}
          onClearLoop={() => setLoopRegion(null)}
        />
      </div>
    </div>
  );
}
