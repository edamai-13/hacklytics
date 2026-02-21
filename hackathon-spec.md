# ChordCoach — Final Locked Engineering Spec

**Project:** Audio → Chord Extraction → Beginner Guitar Tutor
**Build Window:** 16 hours hard cap
**Team Size:** 2–4 people
**Date Locked:** Ready for implementation

---

## 1. Feasibility Verdict: 🟡 YELLOW — Buildable with discipline

**Rationale:**

The critical risk is chord recognition from raw audio. Librosa's chroma features + template matching gives you ~60–70% accuracy on clean recordings for major/minor chords — good enough for a demo, not production. The rest of the stack (timeline viz, fretboard SVG, playback controls) is standard frontend work.

Yellow, not green, because:

- Chord extraction quality is unpredictable on arbitrary uploads. A bad song choice during the demo kills the pitch.
- WaveSurfer integration + custom SVG fretboard + async job pipeline is a lot of surface area for 16 hours.
- Risk collapses to green **if and only if** you pre-analyze 3–5 demo songs and use those for the live demo, with real upload as a "bonus" feature shown second.

**Upgrade path to green:** Pre-compute all demo song analyses. Treat live upload as a stretch feature that you show only if it works cleanly.

---

## 2. Final Locked MVP — 4 Features with Acceptance Criteria

### Feature 1: Audio Upload + Chord Extraction
- **Accepts:** MP3 or MP4 file, ≤ 90 seconds, ≤ 20 MB.
- **Process:** Extract audio (ffmpeg if MP4), compute chroma features (librosa), classify chords via template matching against 14 chord profiles (C, D, E, F, G, A, B × major/minor).
- **Output:** JSON array of `{ chord: "G", start: 0.0, end: 2.4, confidence: 0.82 }`.
- **Acceptance:** Returns a valid chord timeline within 30 seconds for a 90s clip. At least 3 of 5 pre-selected test songs produce recognizable chord progressions.

### Feature 2: Chord Timeline Visualization
- **Displays:** Horizontal scrolling timeline synced to audio playback. Each chord segment is a colored block with label. Playhead moves in real time.
- **Acceptance:** Timeline renders without layout jank. Playhead position matches audio position within ±200ms. Clicking a segment seeks audio to that point.

### Feature 3: Guitar Fretboard with Hand Placement
- **Displays:** SVG fretboard (frets 0–4) showing current chord fingering with numbered dots (finger 1–4) and open/muted string indicators. "Next chord" shown as a ghost/dimmed overlay.
- **Chords supported:** C, D, Dm, E, Em, F, G, A, Am, B7 (10 beginner chords — covers 90%+ of pop songs).
- **Acceptance:** Fretboard updates in sync with playhead. Finger positions are correct for all 10 supported chords. Unsupported chords display the chord name with a "diagram not available" note.

### Feature 4: Practice Controls
- **Loop:** Click two points on timeline to set loop region. Loop plays continuously.
- **Speed:** Buttons for 0.5×, 0.75×, 1.0× playback speed.
- **Acceptance:** Loop is gapless (no click/pop at boundaries). Speed change preserves pitch (use Web Audio API playbackRate). Controls are responsive during playback.

---

## 3. Explicit Cut List — Not In Build

| Feature | Reason |
|---|---|
| YouTube link input | Requires yt-dlp, introduces legal gray area, download latency, and a failure mode you can't control. Cut. Mention as "next feature" in demo. |
| In-app recording | MediaRecorder API + gain/noise issues + extra UI. Not worth the 2 hours. Cut. |
| Song difficulty score | Nice-to-have metric. Can fake with `avg(transition_difficulty)` in 10 minutes post-MVP if time allows. Cut from core. |
| Transition trainer mode | Separate UX flow. Entire second screen. Cut. |
| Smart practice analytics | Requires session persistence, progress tracking, multiple plays. Cut. |
| User auth / accounts | Zero value for a demo. Cut. |
| Any database beyond flat files | SQLite adds migration/schema overhead for zero demo benefit. Cut. Use JSON files on disk. |
| Chord recognition AI/ML model (CREMA, deep learning) | Installation, CUDA/CPU issues, model download size, and debugging a black box under time pressure. The heuristic chroma approach is worse but *predictable*. Cut. If someone on the team has CREMA working locally already, it can be swapped in as a drop-in replacement for the heuristic module behind the same API contract. |

---

## 4. Final Architecture Spec

```
┌─────────────────────────────────────┐
│           FRONTEND (Next.js)        │
│                                     │
│  WaveSurfer.js  ←→  ChordTimeline   │
│  SVG Fretboard  ←→  PlaybackSync    │
│  Upload Form    →   API Client      │
│  Loop/Speed UI                      │
└──────────────┬──────────────────────┘
               │ HTTP (fetch)
               ▼
┌─────────────────────────────────────┐
│         BACKEND (FastAPI)           │
│                                     │
│  POST /analyze    (upload + queue)  │
│  GET  /status/:id (poll status)     │
│  GET  /results/:id(chord JSON)      │
│  GET  /audio/:id  (serve file)      │
│                                     │
│  ChordEngine (librosa + heuristic)  │
│  BackgroundTasks (FastAPI built-in)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         STORAGE (filesystem)        │
│                                     │
│  /uploads/{id}.mp3                  │
│  /results/{id}.json                 │
│  /precomputed/{slug}.json  (demos)  │
└─────────────────────────────────────┘
```

**Key decisions:**

- **No database.** JSON files on disk. Job status tracked in a Python dict (in-memory). This is a 16-hour hackathon — you will not have concurrent users.
- **No Celery/Redis.** Use FastAPI's `BackgroundTasks` for the chord analysis job. One job at a time is fine.
- **No Docker.** Run FastAPI and Next.js dev servers directly. Docker debugging eats hours.
- **ffmpeg** is the only system dependency. Ensure it's installed before coding starts.
- **Precomputed results** live in `/precomputed/` and are loaded directly — no analysis needed. This is your demo safety net.

---

## 5. Final Data Model

### AnalysisJob (in-memory dict, keyed by job_id)

```python
{
  "job_id": "uuid4-string",
  "status": "pending" | "processing" | "done" | "error",
  "filename": "song.mp3",
  "created_at": "ISO8601",
  "duration_sec": 87.3,          # populated after ffprobe
  "error_message": null | "string"
}
```

### ChordResult (JSON file: /results/{job_id}.json)

```json
{
  "job_id": "abc-123",
  "song_name": "song.mp3",
  "duration_sec": 87.3,
  "bpm_estimate": 120,
  "chords": [
    {
      "chord": "G",
      "start": 0.0,
      "end": 2.4,
      "confidence": 0.82
    }
  ],
  "transitions": [
    {
      "from": "G",
      "to": "D",
      "at": 2.4,
      "difficulty": 2
    }
  ]
}
```

### ChordDiagram (static JSON bundled in frontend)

```json
{
  "G": {
    "strings": [3, 2, 0, 0, 0, 3],
    "fingers": [2, 1, 0, 0, 0, 3],
    "muted":   [false, false, false, false, false, false],
    "barres":  []
  }
}
```

`strings` = fret number per string (low E to high E), `0` = open, `-1` = muted.
`fingers` = which finger (0 = open/none, 1–4 = index through pinky).

### TransitionDifficulty (static lookup, hardcoded)

A 10×10 matrix of difficulty scores (1–5) for all beginner chord pairs. Hardcode this — don't compute it. Source it from any guitar teaching site.

---

## 6. Final API Spec

### POST /api/analyze

**Purpose:** Upload audio file and start chord analysis.

```
Input:  multipart/form-data { file: File (mp3/mp4, ≤20MB) }
Output: { "job_id": "uuid", "status": "pending" }
Errors: 400 (wrong format / too large), 500 (ffmpeg failure)
```

### GET /api/status/{job_id}

**Purpose:** Poll analysis progress.

```
Input:  path param job_id
Output: { "job_id": "uuid", "status": "processing" | "done" | "error", "error_message": null }
```

### GET /api/results/{job_id}

**Purpose:** Retrieve chord analysis results.

```
Input:  path param job_id
Output: Full ChordResult JSON (see data model above)
Errors: 404 (not found), 409 (not done yet)
```

### GET /api/audio/{job_id}

**Purpose:** Serve the processed audio file for frontend playback.

```
Input:  path param job_id
Output: audio/mpeg stream
Headers: Accept-Ranges for seeking support
```

### GET /api/demo/{slug}

**Purpose:** Load precomputed demo song (bypass upload/analysis).

```
Input:  path param slug (e.g., "let-it-be", "wonderwall", "horse-with-no-name")
Output: Same ChordResult JSON format + audio file path
```

**That's it. Five endpoints. No more.**

---

## 7. Build Sequence

### Phase 0: Setup (Hours 0–1)

- Scaffold Next.js app + FastAPI app.
- Confirm ffmpeg, librosa, numpy installed and working.
- Create project folder structure.
- Commit "hello world" on both ends.
- Load 3 demo MP3 files (pick songs with simple, well-known progressions).
- **Exit criteria:** Both servers run. `curl POST /api/analyze` returns `{"status": "pending"}`.

### Phase 1: Chord Engine (Hours 1–4) — CRITICAL PATH

- Implement `chord_engine.py`:
  - Load audio with librosa.
  - Compute chroma features (hop_length=4096 for ~0.2s resolution).
  - Build 14 chord templates (major/minor for C through B) as ideal chroma vectors.
  - For each frame, cosine-similarity against all templates → pick best match.
  - Smooth output: merge consecutive identical chords, drop segments < 0.3s.
  - Compute BPM estimate via `librosa.beat.tempo`.
- Generate transition list + difficulty scores from static lookup.
- Wire into FastAPI: upload → ffmpeg extract → chord_engine → save JSON.
- **Pre-compute and cache results for 3 demo songs.**
- **Exit criteria:** `GET /api/results/{id}` returns believable chord JSON for all 3 demo songs.

### ✅ MILESTONE 1 — First Working Version (Hour 4)
> Backend returns real chord data. You can demo the concept with curl + a JSON viewer.

### Phase 2: Core Frontend (Hours 4–8)

- **Hour 4–5:** Upload page + API integration. File picker → POST → poll status → redirect to results page.
- **Hour 5–6.5:** WaveSurfer integration. Audio loads, plays, has basic transport controls. Waveform renders.
- **Hour 6.5–8:** Chord timeline component. Colored blocks rendered above waveform. Synced to playback position via WaveSurfer's `audioprocess` event. Click-to-seek on chord blocks.
- **Exit criteria:** You can upload an MP3, wait for analysis, and see a synced chord timeline playing over the waveform.

### ✅ MILESTONE 2 — End-to-End Demo (Hour 8)
> Upload → analyze → visualize → play. The core loop works.

### Phase 3: Fretboard + Practice (Hours 8–12)

- **Hour 8–9.5:** SVG fretboard component. Static render of any chord from the diagram data. Current chord highlighted, next chord dimmed.
- **Hour 9.5–10.5:** Sync fretboard to playback. On each animation frame, determine current chord from timeline data and update fretboard.
- **Hour 10.5–12:** Practice controls. Loop region selection (click-drag on timeline or two-click). Speed buttons (0.5×, 0.75×, 1×) via `WaveSurfer.setPlaybackRate()`. Upcoming chord indicator.
- **Exit criteria:** Full practice flow works — pick a loop, slow it down, see fingers move on fretboard.

### ✅ MILESTONE 3 — Feature Complete (Hour 12)
> All 4 MVP features working. Stop adding features after this.

### Phase 4: Polish + Demo Prep (Hours 12–15)

- **Hour 12–13:** UI polish. Color scheme, typography, layout spacing. Loading states and error messages. Responsive enough to not break on the projector resolution.
- **Hour 13–14:** Demo hardening. Test the 3 precomputed songs end-to-end 5 times each. Fix any sync glitches, rendering bugs, edge cases. Add smooth transitions between chords on the fretboard (CSS transition on dot positions).
- **Hour 14–15:** Demo script rehearsal. Pre-load demo songs. Write down the exact click sequence. Prepare backup plan (see Section 8). Record a 60-second screen capture as ultimate backup.

### ✅ MILESTONE 4 — Demo Ready (Hour 15)
> Rehearsed twice. Backup video recorded. Precomputed songs verified.

### Phase 5: Buffer (Hour 15–16)

- Fix anything broken.
- If everything works: add one small delight (confetti on song completion, chord name pronunciation, difficulty badge).
- Final commit.

---

## 8. Demo Plan

### Opening Hook (30 seconds)
> *"Every beginner guitarist hits the same wall — they find tabs online but can't keep up with the song. ChordCoach listens to any song and becomes your personal guitar teacher."*

Then: start playback of a recognizable song. The timeline lights up chord by chord, the fretboard fingers move. Let it play for 10 seconds. Visuals do the talking.

### Live Sequence (3 minutes)

1. **Show precomputed demo** (60s): Play a well-known song (pick something with 4–5 chords). Point out the chord timeline, the fretboard updating, the next-chord preview.
2. **Practice mode** (45s): Select a tricky transition (e.g., F→G). Set loop. Drop to 0.5× speed. Show the fretboard slowly transitioning. *"This is where beginners actually learn."*
3. **Live upload** (60s): Upload a *different pre-tested* MP3 that you know works well. Show the upload → processing → results flow. *"This works on any song."* (Only do this if confidence is high. Skip if shaky.)
4. **Architecture flash** (15s): One slide showing the pipeline diagram. Mention librosa chroma features, template matching, real-time sync. Don't dwell.

### Backup Plan

- **If backend is down:** Load precomputed JSON directly in frontend from static files. Serve audio from local assets. The demo looks identical — judges won't know.
- **If live upload fails:** Say *"We've pre-analyzed a library of songs to show the full experience"* and use precomputed demos only. Frame it as a feature, not a failure.
- **If projector/display fails:** Play the pre-recorded 60-second screen capture video from your phone.

**Pre-record the backup video at Hour 14. This is not optional.**

---

## 9. Top Risks + Concrete Fallbacks

| # | Risk | Likelihood | Impact | Fallback |
|---|------|-----------|--------|----------|
| 1 | Chord recognition produces garbage on arbitrary uploads | High | Critical | Pre-analyze 5 songs with known-good results. Demo only uses these. Live upload is a bonus. |
| 2 | WaveSurfer sync with custom timeline is buggy | Medium | High | Decouple: use a simple `setInterval` polling `getCurrentTime()` every 100ms instead of relying on WaveSurfer events. Cruder but reliable. |
| 3 | SVG fretboard takes too long to build | Medium | Medium | Use a static PNG image per chord (screenshot from any chord site). Swap images instead of animating SVG. Looks worse, works in 30 minutes. |
| 4 | librosa/numpy installation issues | Low | Critical | Have a team member verify all Python dependencies install cleanly in Phase 0. If broken, use a pre-built Docker image with scipy stack (exception to the no-Docker rule — only if deps fail natively). |
| 5 | Audio seeking / looping has audible glitches | Medium | Medium | Use WaveSurfer's built-in regions plugin for loop (it handles crossfade). If still glitchy, implement a 50ms fade-in/fade-out at loop boundaries. |
| 6 | Scope creep from "just one more feature" | High | High | After Hour 12, the rule is: **no new features, only bug fixes and polish.** Enforce this socially. |
| 7 | ffmpeg not available or misconfigured | Low | Critical | Test in Phase 0. Bundle a static ffmpeg binary if system install fails. For MP3-only input, ffmpeg isn't even needed — librosa reads MP3 directly. Only needed for MP4→audio extraction. |

---

## 10. Team Split

### 2 People

| Person | Owns | Hours |
|--------|------|-------|
| **A — Backend + Engine** | Chord engine, FastAPI endpoints, ffmpeg pipeline, precomputed demo data, audio serving | 0–12 build, 12–15 integration + demo prep |
| **B — Frontend + UX** | Next.js app, WaveSurfer integration, chord timeline, SVG fretboard, practice controls, all UI polish | 0–12 build, 12–15 integration + demo prep |

Contract point: agree on the API spec and ChordResult JSON format at Hour 0. Build against mocks until integration at Hour 8.

### 3 People

| Person | Owns |
|--------|------|
| **A — Chord Engine** | `chord_engine.py`, template matching, precomputed demos, confidence tuning, transition difficulty |
| **B — Backend + Integration** | FastAPI app, file handling, job management, audio serving, API contract, integration testing |
| **C — Frontend** | Full frontend: upload, timeline, fretboard, practice controls, polish |

A and B pair from Hours 0–4 on the engine, then B splits to API work. C builds against mock JSON from Hour 0.

### 4 People

| Person | Owns |
|--------|------|
| **A — Chord Engine** | Core audio analysis pipeline, tuning, accuracy testing |
| **B — Backend API** | FastAPI, file management, job system, precomputed demo serving |
| **C — Timeline + Playback** | WaveSurfer, chord timeline visualization, sync logic, practice controls (loop/speed) |
| **D — Fretboard + UI** | SVG fretboard, chord diagram data, hand placement rendering, overall UI/UX polish, demo prep |

With 4 people, designate one person (suggest D) as "demo lead" from Hour 12 onward — they own the demo script, backup video, and rehearsal.

---

## 11. Final Go/No-Go Checklist

**All must be TRUE before writing any application code:**

- [ ] Node.js ≥ 18 and Python ≥ 3.10 installed and verified on all dev machines.
- [ ] `ffmpeg -version` returns successfully.
- [ ] `python -c "import librosa; import numpy"` runs without error.
- [ ] Next.js app scaffolded and running on localhost:3000.
- [ ] FastAPI app scaffolded and running on localhost:8000.
- [ ] 3 demo MP3 files selected (< 90s each, well-known songs, simple chord progressions). Recommended: "Let It Be" (Beatles), "Horse With No Name" (America), "Riptide" (Vance Joy).
- [ ] API contract (5 endpoints above) agreed on by all team members.
- [ ] ChordResult JSON schema printed/pinned/shared.
- [ ] Chord diagram data for all 10 beginner chords written and committed as a static JSON file.
- [ ] Transition difficulty matrix (10×10) hardcoded and committed.
- [ ] Git repo created, all members can push.
- [ ] Backup plan understood by all: precomputed demos are the primary demo path.
- [ ] "No new features after Hour 12" rule agreed on verbally.

**If any item is red after 45 minutes of setup, escalate immediately — don't silently debug.**

---

## Appendix A: Chord Template Matching (Implementation Reference)

```python
import librosa
import numpy as np

CHORD_TEMPLATES = {
    "C":  [1,0,0,0,1,0,0,1,0,0,0,0],
    "D":  [0,0,1,0,0,0,1,0,0,1,0,0],
    "Dm": [0,0,1,0,0,1,0,0,0,1,0,0],
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
    
    # Normalize
    templates = templates / (np.linalg.norm(templates, axis=1, keepdims=True) + 1e-8)
    chroma_norm = chroma / (np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-8)
    
    # Cosine similarity per frame
    similarity = templates @ chroma_norm  # (n_chords, n_frames)
    best_idx = np.argmax(similarity, axis=0)
    best_conf = np.max(similarity, axis=0)
    
    # Convert frames to time
    times = librosa.frames_to_time(np.arange(len(best_idx)), sr=sr, hop_length=4096)
    
    # Merge consecutive identical chords
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
    
    # Final segment
    segments.append({
        "chord": current_chord,
        "start": round(float(start), 2),
        "end": round(float(times[-1]), 2),
        "confidence": round(float(np.mean(confs)), 2)
    })
    
    # Filter out very short segments (< 0.3s)
    segments = [s for s in segments if s["end"] - s["start"] >= 0.3]
    
    return segments
```

**This is your starting point. Copy it. Test it on the 3 demo songs. Tune `hop_length` and the 0.3s threshold as needed. Do not rewrite from scratch.**

---

## Appendix B: Chord Diagram Data (Copy-Paste Ready)

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

String order: low E → high E. `-1` = muted. `0` = open.

---

## Appendix C: Transition Difficulty Matrix

Scale 1–5 (1 = easy, 5 = hard). Only the 10 beginner chords.

```
     C  D  Dm  E  Em  F  G  A  Am B7
C    -  2  2   2  1   4  1  2  1  3
D    2  -  1   3  2   3  2  1  2  2
Dm   2  1  -   3  2   3  2  2  1  2
E    2  3  3   -  1   4  2  2  2  3
Em   1  2  2   1  -   3  1  2  1  2
F    4  3  3   4  3   -  3  3  3  4
G    1  2  2   2  1   3  -  2  2  3
A    2  1  2   2  2   3  2  -  1  2
Am   1  2  1   2  1   3  2  1  -  2
B7   3  2  2   3  2   4  3  2  2  -
```

Hardcode this as a nested dict or 2D array. F is hard because barre chord.

---

*This spec is locked. Print it, pin it, and build to it. No scope changes after Hour 0.*
