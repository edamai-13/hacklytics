from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import librosa
import numpy as np

logger = logging.getLogger(__name__)

CHORD_TEMPLATES: dict[str, list[int]] = {
    "C":  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    "D":  [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    "Dm": [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    "E":  [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    "Em": [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    "F":  [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    "G":  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    "A":  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    "Am": [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    "B7": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
}

TRANSITION_DIFFICULTY: dict[str, dict[str, int]] = {
    "C":  {"C": 0, "D": 2, "Dm": 2, "E": 2, "Em": 1, "F": 4, "G": 1, "A": 2, "Am": 1, "B7": 3},
    "D":  {"C": 2, "D": 0, "Dm": 1, "E": 3, "Em": 2, "F": 3, "G": 2, "A": 1, "Am": 2, "B7": 2},
    "Dm": {"C": 2, "D": 1, "Dm": 0, "E": 3, "Em": 2, "F": 3, "G": 2, "A": 2, "Am": 1, "B7": 2},
    "E":  {"C": 2, "D": 3, "Dm": 3, "E": 0, "Em": 1, "F": 4, "G": 2, "A": 2, "Am": 2, "B7": 3},
    "Em": {"C": 1, "D": 2, "Dm": 2, "E": 1, "Em": 0, "F": 3, "G": 1, "A": 2, "Am": 1, "B7": 2},
    "F":  {"C": 4, "D": 3, "Dm": 3, "E": 4, "Em": 3, "F": 0, "G": 3, "A": 3, "Am": 3, "B7": 4},
    "G":  {"C": 1, "D": 2, "Dm": 2, "E": 2, "Em": 1, "F": 3, "G": 0, "A": 2, "Am": 2, "B7": 3},
    "A":  {"C": 2, "D": 1, "Dm": 2, "E": 2, "Em": 2, "F": 3, "G": 2, "A": 0, "Am": 1, "B7": 2},
    "Am": {"C": 1, "D": 2, "Dm": 1, "E": 2, "Em": 1, "F": 3, "G": 2, "A": 1, "Am": 0, "B7": 2},
    "B7": {"C": 3, "D": 2, "Dm": 2, "E": 3, "Em": 2, "F": 4, "G": 3, "A": 2, "Am": 2, "B7": 0},
}


def extract_guitar_stem(audio_path: str, output_dir: str | None = None) -> str:
    """
    Separate the guitar stem from a mixed audio file using Demucs htdemucs_6s.
    Returns the path to the extracted guitar stem WAV.
    Falls back to the original audio_path on any failure so the pipeline never crashes.
    """
    try:
        import torch
        import torchaudio
        from demucs.apply import apply_model
        from demucs.pretrained import get_model
        from demucs.audio import convert_audio

        t0 = time.time()
        logger.info("Starting guitar stem extraction for %s", audio_path)

        out_dir = Path(output_dir) if output_dir else Path(audio_path).parent
        stem_path = out_dir / (Path(audio_path).stem + "_guitar.wav")

        # Load model (cached after first download, ~300 MB).
        model = get_model("htdemucs_6s")
        model.eval()

        # Load and resample to model's expected sample rate.
        wav, sr = torchaudio.load(audio_path)
        wav = convert_audio(wav, sr, model.samplerate, model.audio_channels)
        wav = wav.unsqueeze(0)  # add batch dim

        with torch.no_grad():
            sources = apply_model(model, wav, device="cpu", progress=False)[0]

        # htdemucs_6s stem order: drums, bass, other, vocals, guitar, piano
        source_names = model.sources
        if "guitar" not in source_names:
            logger.warning("htdemucs_6s 'guitar' stem not found. Available: %s", source_names)
            return audio_path

        guitar_idx = source_names.index("guitar")
        guitar_wav = sources[guitar_idx]  # (channels, samples)

        torchaudio.save(str(stem_path), guitar_wav, model.samplerate)

        elapsed = time.time() - t0
        logger.info("Guitar stem extraction complete (%.1fs). Proceeding with chord analysis.", elapsed)
        return str(stem_path)

    except ImportError:
        logger.warning("Demucs not installed — skipping source separation. Run: pip install demucs")
        return audio_path
    except Exception as exc:
        logger.warning("Guitar stem extraction failed (%s) — falling back to original audio.", exc)
        return audio_path


def analyze(audio_path: str, hop_length: int = 4096, separate: bool = False) -> list[dict[str, Any]]:
    stem_path: str | None = None
    if separate:
        extracted = extract_guitar_stem(audio_path, output_dir=str(Path(audio_path).parent))
        # Only use the extracted stem if it's different from the original (i.e. separation succeeded).
        if extracted != audio_path:
            stem_path = extracted
    source = stem_path if stem_path else audio_path

    try:
        return _run_chord_detection(source, hop_length)
    finally:
        # Always clean up the temp stem file.
        if stem_path:
            try:
                Path(stem_path).unlink(missing_ok=True)
            except Exception:
                pass


def _run_chord_detection(audio_path: str, hop_length: int) -> list[dict[str, Any]]:
    y, sr = librosa.load(audio_path, sr=22050)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)

    templates = np.array(list(CHORD_TEMPLATES.values()), dtype=float)
    names = list(CHORD_TEMPLATES.keys())

    templates = templates / (np.linalg.norm(templates, axis=1, keepdims=True) + 1e-8)
    chroma_norm = chroma / (np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-8)

    similarity = templates @ chroma_norm  # (n_chords, n_frames)
    best_idx = np.argmax(similarity, axis=0)
    best_conf = np.max(similarity, axis=0)

    times = librosa.frames_to_time(np.arange(len(best_idx)), sr=sr, hop_length=hop_length)

    segments: list[dict[str, Any]] = []
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
                "confidence": round(float(np.mean(confs)), 2),
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
        "confidence": round(float(np.mean(confs)), 2),
    })

    segments = [s for s in segments if s["end"] - s["start"] >= 0.3]
    return segments


def build_transitions(chords: list[dict[str, Any]]) -> list[dict[str, Any]]:
    transitions: list[dict[str, Any]] = []
    for i in range(len(chords) - 1):
        from_chord = chords[i]["chord"]
        to_chord = chords[i + 1]["chord"]
        difficulty = TRANSITION_DIFFICULTY.get(from_chord, {}).get(to_chord, 3)
        transitions.append({
            "from": from_chord,
            "to": to_chord,
            "at": chords[i + 1]["start"],
            "difficulty": difficulty,
        })
    return transitions


def build_next_chord_predictions(
    chords: list[dict[str, Any]], top_k: int = 3
) -> dict[str, list[dict[str, Any]]]:
    counts: dict[str, dict[str, int]] = {}
    for i in range(len(chords) - 1):
        cur = chords[i]["chord"]
        nxt = chords[i + 1]["chord"]
        counts.setdefault(cur, {})
        counts[cur][nxt] = counts[cur].get(nxt, 0) + 1

    predictions: dict[str, list[dict[str, Any]]] = {}
    for chord, next_counts in counts.items():
        total = sum(next_counts.values())
        ranked = sorted(next_counts.items(), key=lambda item: item[1], reverse=True)
        predictions[chord] = [
            {"chord": nxt, "probability": round(cnt / total, 3)}
            for nxt, cnt in ranked[:top_k]
        ]
    return predictions
