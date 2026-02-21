import uuid
import json
import shutil
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from engine.chord_engine import analyze, build_transitions, build_next_chord_predictions

app = FastAPI(title="ChordCoach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS = Path("uploads")
RESULTS = Path("results")
PRECOMPUTED = Path("precomputed")

UPLOADS.mkdir(exist_ok=True)
RESULTS.mkdir(exist_ok=True)
PRECOMPUTED.mkdir(exist_ok=True)

# In-memory job store (keyed by job_id)
jobs: dict[str, dict[str, Any]] = {}

ALLOWED_EXTENSIONS = {".mp3", ".mp4"}
MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


def run_analysis(job_id: str, audio_path: Path, original_name: str) -> None:
    jobs[job_id]["status"] = "processing"
    try:
        chords = analyze(str(audio_path))
        transitions = build_transitions(chords)
        next_chord_predictions = build_next_chord_predictions(chords, top_k=3)

        import librosa
        y, sr = librosa.load(str(audio_path), sr=22050, duration=None)
        duration_sec = float(librosa.get_duration(y=y, sr=sr))
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = int(round(float(np.atleast_1d(tempo)[0])))

        result = {
            "job_id": job_id,
            "song_name": original_name,
            "duration_sec": round(duration_sec, 2),
            "bpm_estimate": bpm,
            "chords": chords,
            "transitions": transitions,
            "next_chord_predictions": next_chord_predictions,
        }

        result_path = RESULTS / f"{job_id}.json"
        result_path.write_text(json.dumps(result, indent=2))

        jobs[job_id]["status"] = "done"
        jobs[job_id]["duration_sec"] = duration_sec

    except Exception as exc:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error_message"] = str(exc)


@app.post("/api/analyze")
async def analyze_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only MP3 and MP4 files are accepted.")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 20 MB limit.")

    job_id = str(uuid.uuid4())
    audio_path = UPLOADS / f"{job_id}{suffix}"
    audio_path.write_bytes(content)

    # If MP4, extract audio with ffmpeg
    if suffix == ".mp4":
        mp3_path = UPLOADS / f"{job_id}.mp3"
        import subprocess
        result = subprocess.run(
            ["ffmpeg", "-i", str(audio_path), "-q:a", "0", "-map", "a", str(mp3_path), "-y"],
            capture_output=True,
        )
        if result.returncode != 0:
            audio_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Could not extract audio from MP4. Try an MP3 instead.")
        audio_path.unlink(missing_ok=True)
        audio_path = mp3_path

    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "duration_sec": None,
        "error_message": None,
    }

    background_tasks.add_task(run_analysis, job_id, audio_path, file.filename or "unknown")
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "job_id": job_id,
        "status": job["status"],
        "error_message": job.get("error_message"),
    }


@app.get("/api/results/{job_id}")
def get_results(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"Job is not done yet (status: {job['status']}).")

    result_path = RESULTS / f"{job_id}.json"
    if not result_path.exists():
        raise HTTPException(status_code=404, detail="Result file not found.")
    return JSONResponse(content=json.loads(result_path.read_text()))


@app.get("/api/audio/{job_id}")
def get_audio(job_id: str):
    audio_path = UPLOADS / f"{job_id}.mp3"
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


@app.get("/api/demo/{slug}")
def get_demo(slug: str):
    json_path = PRECOMPUTED / f"{slug}.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail=f"Demo '{slug}' not found.")
    data = json.loads(json_path.read_text())
    data["audio_url"] = f"/api/demo/{slug}/audio"
    return JSONResponse(content=data)


@app.get("/api/demo/{slug}/audio")
def get_demo_audio(slug: str):
    for ext in [".mp3", ".mp4"]:
        audio_path = PRECOMPUTED / f"{slug}{ext}"
        if audio_path.exists():
            return FileResponse(
                path=str(audio_path),
                media_type="audio/mpeg",
                headers={"Accept-Ranges": "bytes"},
            )
    raise HTTPException(status_code=404, detail=f"Audio for demo '{slug}' not found.")
