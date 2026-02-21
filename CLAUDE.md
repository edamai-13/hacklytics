# CLAUDE.md — ChordCoach Instruction Manual

## 1. Project Overview

ChordCoach extracts chord progressions from audio files and teaches beginner guitarists by displaying a synced chord timeline, an SVG fretboard with finger placement, and practice controls (loop + speed). The build window is 16 hours hard cap. Philosophy: **demo reliability > feature breadth** — three precomputed demo songs must work flawlessly; live upload is a bonus feature shown only if it works cleanly.

---

## 2. Tech Stack

**Frontend**
- Next.js (latest stable, App Router)
- WaveSurfer.js (v7+) — waveform rendering and playback
- WaveSurfer Regions plugin — loop region support
- TypeScript — strict mode
- Tailwind CSS — styling

**Backend**
- Python ≥ 3.10
- FastAPI — HTTP server
- librosa — audio analysis and chroma features
- numpy — matrix operations
- python-multipart — file upload support
- uvicorn — ASGI server

**System Dependencies**
- ffmpeg — MP4→audio extraction (must be installed before coding starts; verify with `ffmpeg -version`)

**Explicitly NOT used:**
- No database (SQLite, Postgres, MongoDB, etc.)
- No Docker (for development)
- No Celery, Redis, or any external job queue
- No authentication or user accounts
- No yt-dlp or YouTube input
- No deep learning models (CREMA, etc.)

---

## 3. Project Structure

```
/
├── frontend/                  → Next.js app (localhost:3000)
│   ├── app/
│   │   ├── page.tsx           → Upload page
│   │   └── results/[id]/
│   │       └── page.tsx       → Results + practice page
│   ├── components/
│   │   ├── UploadForm.tsx
│   │   ├── WavePlayer.tsx     → WaveSurfer wrapper
│   │   ├── ChordTimeline.tsx  → Colored chord blocks, synced playhead
│   │   ├── Fretboard.tsx      → SVG fretboard, current + next chord
│   │   └── PracticeControls.tsx → Loop region + speed buttons
│   ├── data/
│   │   ├── chords.json        → Chord diagram data (Appendix B — LOCKED)
│   │   └── transitions.json   → Difficulty matrix (Appendix C — LOCKED)
│   └── lib/
│       └── api.ts             → Typed API client
│
├── backend/                   → FastAPI app (localhost:8000)
│   ├── main.py                → FastAPI app, all 5 endpoints
│   ├── engine/
│   │   └── chord_engine.py    → Core chord extraction (Appendix A — LOCKED)
│   ├── uploads/               → Uploaded audio files ({job_id}.mp3)
│   ├── results/               → Analysis output ({job_id}.json)
│   └── precomputed/           → Pre-analyzed demo songs ({slug}.json + audio)
│
└── CLAUDE.md
```

Every file goes exactly where the tree above specifies. Do not create files outside this structure.

---

## 4. Key Files Reference

| File | Purpose |
|------|---------|
| `backend/engine/chord_engine.py` | Core chord extraction. **Copy the implementation from Appendix A of the spec verbatim before modifying.** |
| `frontend/data/chords.json` | Chord diagram data for 10 beginner chords. **Copy from Appendix B verbatim.** |
| `frontend/data/transitions.json` | 10×10 difficulty matrix. **Copy from Appendix C verbatim.** |
| `backend/precomputed/demo-1.json` | Pre-analyzed "Let It Be" (Beatles) |
| `backend/precomputed/demo-2.json` | Pre-analyzed "Horse With No Name" (America) |
| `backend/precomputed/demo-3.json` | Pre-analyzed "Riptide" (Vance Joy) |
| `backend/main.py` | All 5 API endpoints. No additional endpoints. |
| `frontend/lib/api.ts` | Typed API client used by all components. |

When creating `chord_engine.py`, `chords.json`, and `transitions.json`, copy the reference implementations from the spec exactly before making any modifications.

---

## 5. API Contract — LOCKED

**This API contract is LOCKED. Do not add, remove, or rename endpoints.**

### POST /api/analyze
```
Input:  multipart/form-data { file: File (mp3/mp4, ≤20MB) }
Output: { "job_id": "uuid", "status": "pending" }
Errors: 400 (wrong format / too large), 500 (ffmpeg failure)
```

### GET /api/status/{job_id}
```
Input:  path param job_id
Output: { "job_id": "uuid", "status": "processing" | "done" | "error", "error_message": null | "string" }
```

### GET /api/results/{job_id}
```
Input:  path param job_id
Output: Full ChordResult JSON (see schemas below)
Errors: 404 (not found), 409 (not done yet)
```

### GET /api/audio/{job_id}
```
Input:  path param job_id
Output: audio/mpeg stream
Headers: Accept-Ranges (required for seeking support)
```

### GET /api/demo/{slug}
```
Input:  path param slug ("demo-1", "demo-2", "demo-3")
Output: ChordResult JSON + audio_url field pointing to the audio file
```

Five endpoints. No more.

---

## 6. Data Schemas — LOCKED

**These schemas are LOCKED. All code must conform to these exact shapes.**

### AnalysisJob (in-memory Python dict, keyed by job_id)
```python
{
  "job_id": "uuid4-string",
  "status": "pending" | "processing" | "done" | "error",
  "filename": "song.mp3",
  "created_at": "ISO8601",
  "duration_sec": 87.3,       # populated after ffprobe
  "error_message": None | "string"
}
```

### ChordResult (written to /backend/results/{job_id}.json)
```json
{
  "job_id": "abc-123",
  "song_name": "song.mp3",
  "duration_sec": 87.3,
  "bpm_estimate": 120,
  "chords": [
    { "chord": "G", "start": 0.0, "end": 2.4, "confidence": 0.82 }
  ],
  "transitions": [
    { "from": "G", "to": "D", "at": 2.4, "difficulty": 2 }
  ]
}
```

### ChordDiagram (static JSON in frontend/data/chords.json)
```json
{
  "G": {
    "frets":   [3, 2, 0, 0, 0, 3],
    "fingers": [2, 1, 0, 0, 0, 3]
  }
}
```
String order: low E → high E. `-1` = muted. `0` = open. `fingers`: 0 = open/none, 1–4 = index through pinky.

---

## 7. Build Phases & Rules

### Phase 0 — Setup (Hours 0–1)
- Scaffold Next.js app in `/frontend`, FastAPI app in `/backend`.
- Verify: `ffmpeg -version`, `python -c "import librosa; import numpy"`, both servers start.
- Create full folder structure as defined in Section 3.
- Commit `chords.json` and `transitions.json` with exact data from Appendices B and C.
- Load 3 demo MP3 files into `backend/precomputed/`.
- **Exit criteria:** `curl -X POST http://localhost:8000/api/analyze` returns `{"status": "pending"}`.

### Phase 1 — Chord Engine (Hours 1–4) — CRITICAL PATH
- Implement `chord_engine.py` using the reference from Appendix A (copy verbatim first).
- Wire FastAPI endpoints: upload → ffmpeg extract → `chord_engine.analyze()` → save JSON.
- Pre-compute and save results for all 3 demo songs as `precomputed/demo-1.json`, etc.
- **Exit criteria:** `GET /api/results/{id}` returns valid ChordResult JSON for all 3 demo songs.

### Phase 2 — Core Frontend (Hours 4–8)
- Upload page + API integration: file picker → POST → poll status → redirect to results.
- WaveSurfer integration: audio loads, plays, waveform renders, basic transport.
- ChordTimeline component: colored blocks above waveform, synced to playback, click-to-seek.
- **Exit criteria:** Upload MP3 → wait for analysis → see synced chord timeline playing.

### Phase 3 — Fretboard + Practice (Hours 8–12)
- SVG Fretboard component: renders any chord from `chords.json`, current chord highlighted, next chord dimmed.
- Sync fretboard to playback via `requestAnimationFrame` or polling.
- Practice controls: loop region (two-click or click-drag on timeline), speed buttons (0.5×, 0.75×, 1.0×) via `WaveSurfer.setPlaybackRate()`.
- **Exit criteria:** Full practice flow — pick loop, slow down, fretboard fingers move in sync.

### Phase 4 — Polish + Demo Prep (Hours 12–15)
- UI polish: color scheme, loading states, error messages, responsive layout.
- Demo hardening: test all 3 precomputed songs end-to-end 5 times each.
- CSS transitions on fretboard dot positions between chords.
- Demo script rehearsal. Pre-record 60-second backup video.

**After Phase 3 is complete, NO NEW FEATURES. Only bug fixes and polish.**

---

## 8. Coding Standards & Conventions

**Python:**
- Type hints on all functions (no bare `def foo(x)`)
- f-strings for string formatting
- `pathlib.Path` for all file path operations (not `os.path`)
- Every endpoint must have `try/except` with proper HTTP status codes (400, 404, 409, 500)

**TypeScript/React:**
- Functional components only — no class components
- `camelCase` for variables and functions
- Every component must handle `loading` and `error` states explicitly
- No `console.log` in committed code — remove before committing

**Naming:**
- Python: `snake_case` for variables, functions, files
- TypeScript: `camelCase` for variables/functions, `PascalCase` for components/types

---

## 9. Critical Constraints

- **NEVER** install or use a database. All persistence is JSON files on disk.
- **NEVER** add authentication or user accounts.
- **NEVER** use Celery, Redis, or any external job queue. Use FastAPI `BackgroundTasks` only.
- **NEVER** use Docker for development.
- **NEVER** add endpoints beyond the 5 specified in the API contract.
- **NEVER** add new features after Phase 3 is complete (Hour 12).
- If chord recognition produces poor results on an arbitrary upload, that is expected. Do not try to fix the algorithm — use precomputed demos for reliability.
- Audio files are stored in `backend/uploads/{job_id}.mp3`.
- Result JSONs are stored in `backend/results/{job_id}.json`.
- The 3 precomputed demo songs **MUST** work perfectly. They are the demo safety net.

---

## 10. Fallback Strategies

- **WaveSurfer sync unreliable:** Fall back to polling `wavesurfer.getCurrentTime()` every 100ms with `setInterval`. Cruder but reliable.
- **SVG fretboard taking too long:** Switch to static PNG images per chord (screenshot from any chord site). Swap `<img src={`/chords/${chord}.png`} />` instead of rendering SVG. Looks worse, works in 30 minutes.
- **librosa chroma giving bad results on a specific song:** Adjust `hop_length` — try 2048, 4096, 8192 in that order. Or switch from `chroma_cqt` to `chroma_stft`.
- **ffmpeg fails on an MP4:** Return a clear 400/500 error to the user with a message like `"Could not extract audio from this file. Please try an MP3."` Do not crash the server.
- **librosa/numpy install fails natively:** As an exception to the no-Docker rule, use a pre-built Docker image with the scipy stack. This is the only permitted Docker exception.
- **Audio looping has glitches:** Use WaveSurfer's built-in regions plugin (it handles crossfade). If still glitchy, add a 50ms fade-in/fade-out at loop boundaries.

---

## 11. Testing Checkpoints

**After Phase 1:**
```bash
cd backend
python -c "from engine.chord_engine import analyze; import json; print(json.dumps(analyze('precomputed/demo-1.mp3'), indent=2))"
# Verify: returns a list of chord dicts with chord, start, end, confidence fields
```

**After Phase 2:**
```bash
# Start both servers
cd backend && uvicorn main:app --reload --port 8000 &
cd frontend && npm run dev &
# Open http://localhost:3000
# Upload an MP3 via the UI
# Verify: chord timeline renders with colored chord blocks synced to audio
```

**After Phase 3:**
```bash
# Open http://localhost:3000
# Load demo-1 via GET /api/demo/demo-1
# Play the song — verify fretboard updates in sync with playhead
# Click two points on timeline to set a loop region
# Drop speed to 0.5x — verify loop plays without audio glitches
```

**After Phase 4:**
```bash
# Run through all 3 demo songs (demo-1, demo-2, demo-3) start-to-finish
# Each must complete with no errors, no sync drift, no layout breaks
# Record screen if possible — this is the backup demo video
```

---

## 12. Demo Song Configuration

- The app must ship with 3 pre-analyzed demo songs accessible via `GET /api/demo/{slug}`.
- **Demo slugs:** `demo-1` (Let It Be — Beatles), `demo-2` (Horse With No Name — America), `demo-3` (Riptide — Vance Joy).
- Precomputed JSON files follow the exact ChordResult schema from Section 6.
- Demo songs must load **instantly** with NO processing delay — they are served directly from `backend/precomputed/`.
- Demo audio files live at `backend/precomputed/demo-1.mp3`, `demo-2.mp3`, `demo-3.mp3`.
- The `GET /api/demo/{slug}` response must include an `audio_url` field pointing to the audio endpoint so the frontend can load both data and audio in one call.

---

## Appendix A: chord_engine.py — Reference Implementation

Copy this verbatim into `backend/engine/chord_engine.py`. Tune `hop_length` and the 0.3s threshold as needed. Do not rewrite from scratch.

```python
import librosa
import numpy as np

CHORD_TEMPLATES = {
    "C":  [1,0,0,0,1,0,0,1,0,0,0,0],
    "D":  [0,0,1,0,0,0,1,0,0,1,0,0],
    "Dm": [0,0,1,0,0,0,1,0,0,1,0,0],
    "E":  [0,0,0,0,1,0,0,0,1,0,0,0],
    "Em": [0,0,0,0,1,0,0,1,0,0,0,0],
    "F":  [0,0,0,0,0,1,0,0,1,0,0,0],
    "G":  [0,0,0,0,0,0,0,1,0,0,0,1],
    "A":  [0,0,0,0,0,0,0,0,0,1,0,0],
    "Am": [1,0,0,0,1,0,0,0,0,1,0,0],
    "B7": [0,0,1,0,0,0,1,0,0,0,0,1],
}

def analyze(audio_path: str) -> list[dict]:
    y, sr = librosa.load(audio_path, sr=22050)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=4096)

    templates = np.array(list(CHORD_TEMPLATES.values()), dtype=float)
    names = list(CHORD_TEMPLATES.keys())

    templates = templates / (np.linalg.norm(templates, axis=1, keepdims=True) + 1e-8)
    chroma_norm = chroma / (np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-8)

    similarity = templates @ chroma_norm  # (n_chords, n_frames)
    best_idx = np.argmax(similarity, axis=0)
    best_conf = np.max(similarity, axis=0)

    times = librosa.frames_to_time(np.arange(len(best_idx)), sr=sr, hop_length=4096)

    segments = []
    current_chord = names[best_idx[0]]
    start = times[0]
    confs = [best_conf[0]]

    for i in range(1, len(best_idx)):
        chord = names[best_idx[i]]
        if chord != current_chord:
            segments.append({
                "chord": current_chord,
                "start": round(float(start), 2),
                "end": round(float(times[i]), 2),
                "confidence": round(float(np.mean(confs)), 2)
            })
            current_chord = chord
            start = times[i]
            confs = [best_conf[i]]
        else:
            confs.append(best_conf[i])

    segments.append({
        "chord": current_chord,
        "start": round(float(start), 2),
        "end": round(float(times[-1]), 2),
        "confidence": round(float(np.mean(confs)), 2)
    })

    segments = [s for s in segments if s["end"] - s["start"] >= 0.3]
    return segments
```

---

## Appendix B: frontend/data/chords.json — Reference Data

Copy this verbatim. String order: low E → high E. `-1` = muted. `0` = open.

```json
{
  "C":  { "frets": [-1, 3, 2, 0, 1, 0], "fingers": [0, 3, 2, 0, 1, 0] },
  "D":  { "frets": [-1, -1, 0, 2, 3, 2], "fingers": [0, 0, 0, 1, 3, 2] },
  "Dm": { "frets": [-1, -1, 0, 2, 3, 1], "fingers": [0, 0, 0, 2, 3, 1] },
  "E":  { "frets": [0, 2, 2, 1, 0, 0],   "fingers": [0, 2, 3, 1, 0, 0] },
  "Em": { "frets": [0, 2, 2, 0, 0, 0],   "fingers": [0, 2, 3, 0, 0, 0] },
  "F":  { "frets": [1, 1, 2, 3, 3, 1],   "fingers": [1, 1, 2, 3, 4, 1], "barre": 1 },
  "G":  { "frets": [3, 2, 0, 0, 0, 3],   "fingers": [2, 1, 0, 0, 0, 3] },
  "A":  { "frets": [-1, 0, 2, 2, 2, 0],  "fingers": [0, 0, 1, 2, 3, 0] },
  "Am": { "frets": [-1, 0, 2, 2, 1, 0],  "fingers": [0, 0, 2, 3, 1, 0] },
  "B7": { "frets": [-1, 2, 1, 2, 0, 2],  "fingers": [0, 2, 1, 3, 0, 4] }
}
```

---

## Appendix C: frontend/data/transitions.json — Difficulty Matrix

Scale 1–5 (1 = easy, 5 = hard). Hardcode as a nested object. F is hard because barre chord.

```json
{
  "C":  { "C": 0, "D": 2, "Dm": 2, "E": 2, "Em": 1, "F": 4, "G": 1, "A": 2, "Am": 1, "B7": 3 },
  "D":  { "C": 2, "D": 0, "Dm": 1, "E": 3, "Em": 2, "F": 3, "G": 2, "A": 1, "Am": 2, "B7": 2 },
  "Dm": { "C": 2, "D": 1, "Dm": 0, "E": 3, "Em": 2, "F": 3, "G": 2, "A": 2, "Am": 1, "B7": 2 },
  "E":  { "C": 2, "D": 3, "Dm": 3, "E": 0, "Em": 1, "F": 4, "G": 2, "A": 2, "Am": 2, "B7": 3 },
  "Em": { "C": 1, "D": 2, "Dm": 2, "E": 1, "Em": 0, "F": 3, "G": 1, "A": 2, "Am": 1, "B7": 2 },
  "F":  { "C": 4, "D": 3, "Dm": 3, "E": 4, "Em": 3, "F": 0, "G": 3, "A": 3, "Am": 3, "B7": 4 },
  "G":  { "C": 1, "D": 2, "Dm": 2, "E": 2, "Em": 1, "F": 3, "G": 0, "A": 2, "Am": 2, "B7": 3 },
  "A":  { "C": 2, "D": 1, "Dm": 2, "E": 2, "Em": 2, "F": 3, "G": 2, "A": 0, "Am": 1, "B7": 2 },
  "Am": { "C": 1, "D": 2, "Dm": 1, "E": 2, "Em": 1, "F": 3, "G": 2, "A": 1, "Am": 0, "B7": 2 },
  "B7": { "C": 3, "D": 2, "Dm": 2, "E": 3, "Em": 2, "F": 4, "G": 3, "A": 2, "Am": 2, "B7": 0 }
}
```
