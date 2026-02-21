import librosa
import numpy as np

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


def analyze(audio_path: str, hop_length: int = 4096) -> list[dict]:
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

    segments: list[dict] = []
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


def build_transitions(chords: list[dict]) -> list[dict]:
    transitions: list[dict] = []
    for i in range(len(chords) - 1):
        from_chord = chords[i]["chord"]
        to_chord = chords[i + 1]["chord"]
        difficulty = (
            TRANSITION_DIFFICULTY.get(from_chord, {}).get(to_chord, 3)
        )
        transitions.append({
            "from": from_chord,
            "to": to_chord,
            "at": chords[i + 1]["start"],
            "difficulty": difficulty,
        })
    return transitions
