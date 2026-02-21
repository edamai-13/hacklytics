"use client";

interface Props {
  playbackRate: number;
  onRateChange: (rate: number) => void;
  loopRegion: [number, number] | null;
  onClearLoop: () => void;
}

const RATES = [0.5, 0.75, 1.0];

export default function PracticeControls({ playbackRate, onRateChange, loopRegion, onClearLoop }: Props) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 space-y-5">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Practice Controls</h2>

      <div className="space-y-2">
        <p className="text-xs text-neutral-500">Playback speed</p>
        <div className="flex gap-2">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => onRateChange(r)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                playbackRate === r
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {r === 1 ? "1×" : `${r}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-neutral-500">Loop region</p>
        {loopRegion ? (
          <div className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2">
            <span className="text-sm text-neutral-300">
              {loopRegion[0].toFixed(1)}s → {loopRegion[1].toFixed(1)}s
            </span>
            <button
              onClick={onClearLoop}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 rounded-lg bg-neutral-800 px-3 py-2">
            Click two points on the timeline to set a loop
          </p>
        )}
      </div>
    </div>
  );
}
