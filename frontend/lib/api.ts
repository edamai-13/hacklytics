const BASE = "/api";

export interface ChordSegment {
  chord: string;
  start: number;
  end: number;
  confidence: number;
}

export interface ChordTransition {
  from: string;
  to: string;
  at: number;
  difficulty: number;
}

export interface ChordResult {
  job_id: string;
  song_name: string;
  duration_sec: number;
  bpm_estimate: number;
  chords: ChordSegment[];
  transitions: ChordTransition[];
  audio_url?: string;
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
}

export async function uploadAudio(file: File): Promise<{ job_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/analyze`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function pollStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${BASE}/status/${jobId}`);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}

export async function getResults(jobId: string): Promise<ChordResult> {
  const res = await fetch(`${BASE}/results/${jobId}`);
  if (!res.ok) throw new Error(`Could not load results (${res.status})`);
  return res.json();
}

export async function getDemoResults(slug: string): Promise<ChordResult> {
  const res = await fetch(`${BASE}/demo/${slug}`);
  if (!res.ok) throw new Error(`Demo not found (${res.status})`);
  return res.json();
}

export async function loadDemo(slug: string): Promise<ChordResult> {
  return getDemoResults(slug);
}
