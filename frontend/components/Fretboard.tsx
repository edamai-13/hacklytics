"use client";

import chordsData from "@/data/chords.json";

interface ChordShape {
  frets: number[];
  fingers: number[];
  barre?: number;
}

const CHORDS = chordsData as Record<string, ChordShape>;

const STRING_LABELS = ["E", "A", "D", "G", "B", "e"];
const FRET_COUNT = 5;
const STRING_COUNT = 6;

interface Props {
  currentChord: string | null;
  nextChord: string | null;
}

function FretboardSVG({ chord, dimmed }: { chord: string; dimmed?: boolean }) {
  const shape = CHORDS[chord];
  const W = 160;
  const H = 180;
  const padLeft = 30;
  const padTop = 30;
  const stringSpacing = (W - padLeft - 10) / (STRING_COUNT - 1);
  const fretSpacing = (H - padTop - 10) / FRET_COUNT;

  return (
    <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${dimmed ? "opacity-40" : "opacity-100"}`}>
      <span className="text-sm font-bold text-neutral-300">{chord}</span>
      {!shape ? (
        <div className="w-40 h-44 flex items-center justify-center rounded-lg border border-neutral-700 text-xs text-neutral-500 text-center px-2">
          Diagram not available
        </div>
      ) : (
        <svg width={W} height={H} className="overflow-visible">
          {/* Nut */}
          <line x1={padLeft} y1={padTop} x2={W - 10} y2={padTop} stroke="#aaa" strokeWidth={3} />

          {/* Fret lines */}
          {Array.from({ length: FRET_COUNT }).map((_, f) => (
            <line
              key={f}
              x1={padLeft}
              y1={padTop + (f + 1) * fretSpacing}
              x2={W - 10}
              y2={padTop + (f + 1) * fretSpacing}
              stroke="#444"
              strokeWidth={1}
            />
          ))}

          {/* String lines */}
          {Array.from({ length: STRING_COUNT }).map((_, s) => (
            <line
              key={s}
              x1={padLeft + s * stringSpacing}
              y1={padTop}
              x2={padLeft + s * stringSpacing}
              y2={padTop + FRET_COUNT * fretSpacing}
              stroke="#555"
              strokeWidth={1}
            />
          ))}

          {/* Open / muted indicators */}
          {shape.frets.map((fret, s) => {
            const cx = padLeft + s * stringSpacing;
            const cy = padTop - 12;
            if (fret === -1) {
              return (
                <text key={s} x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="#ef4444" fontWeight="bold">
                  ×
                </text>
              );
            }
            if (fret === 0) {
              return (
                <circle key={s} cx={cx} cy={cy} r={5} fill="none" stroke="#aaa" strokeWidth={1.5} />
              );
            }
            return null;
          })}

          {/* Finger dots */}
          {shape.frets.map((fret, s) => {
            if (fret <= 0) return null;
            const cx = padLeft + s * stringSpacing;
            const cy = padTop + (fret - 0.5) * fretSpacing;
            const finger = shape.fingers[s];
            return (
              <g key={s}>
                <circle cx={cx} cy={cy} r={10} fill="#3b82f6" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold">
                  {finger > 0 ? finger : ""}
                </text>
              </g>
            );
          })}

          {/* Barre indicator */}
          {shape.barre && (
            <rect
              x={padLeft}
              y={padTop + (shape.barre - 0.5) * fretSpacing - 10}
              width={W - padLeft - 10}
              height={20}
              rx={10}
              fill="#3b82f6"
              opacity={0.3}
            />
          )}
        </svg>
      )}
    </div>
  );
}

export default function Fretboard({ currentChord, nextChord }: Props) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Fretboard</h2>

      {!currentChord ? (
        <p className="text-neutral-500 text-sm">Play the song to see finger positions.</p>
      ) : (
        <div className="flex items-start gap-8">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Now</span>
            <FretboardSVG chord={currentChord} />
          </div>
          {nextChord && (
            <div className="space-y-1">
              <span className="text-xs text-neutral-500">Next</span>
              <FretboardSVG chord={nextChord} dimmed />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
