/**
 * Mock research pipeline — simulates the FastAPI backend so the UI is
 * fully clickable in the Lovable preview without external services.
 * The phase set mirrors orion-insights' orchestration graph.
 */
export const PIPELINE = [
  "intake",
  "clarify",
  "retrieve",
  "score",
  "analyse",
  "insight",
  "guardrail",
  "report",
] as const;
export type Phase = (typeof PIPELINE)[number];

export type Persona = "researcher" | "product_manager" | "content_creator";

export interface Source {
  url: string;
  title: string;
  source_type: "academic" | "news" | "blog" | "report";
  confidence: number;
  rationale?: string;
}

export interface Insight {
  title: string;
  summary: string;
  implications: string;
  confidence: number;
}

export interface SessionState {
  sid: string;
  topic: string;
  persona: Persona;
  threshold: number;
  startedAt: number;
  phase: Phase;
  sources?: Source[];
  curated?: string[];
  analysis?: string;
  insights?: Insight[];
  guardrail?: { pass: boolean; reason: string };
  report?: string;
  error?: string;
}

export interface SessionStatus {
  sid: string;
  status: "queued" | "running" | "complete";
  progress: number;
  current_phase: Phase;
  report_url?: string;
}

const sessions = new Map<string, SessionState>();

function persist() {
  if (typeof window === "undefined") return;
  const out: Record<string, SessionState> = {};
  sessions.forEach((v, k) => (out[k] = v));
  window.localStorage.setItem("orion.sessions", JSON.stringify(out));
}
function hydrate() {
  if (typeof window === "undefined" || sessions.size > 0) return;
  try {
    const raw = window.localStorage.getItem("orion.sessions");
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, SessionState>;
    Object.entries(obj).forEach(([k, v]) => sessions.set(k, v));
  } catch {
    /* ignore */
  }
}

export function startResearch(input: {
  topic: string;
  persona: Persona;
  threshold: number;
}): SessionState {
  hydrate();
  const sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const state: SessionState = {
    sid,
    topic: input.topic,
    persona: input.persona,
    threshold: input.threshold,
    startedAt: Date.now(),
    phase: "intake",
  };
  sessions.set(sid, state);
  persist();
  return state;
}

export function getSession(sid: string): SessionState | null {
  hydrate();
  return sessions.get(sid) ?? null;
}

export function updateSession(sid: string, patch: Partial<SessionState>): SessionState | null {
  const s = getSession(sid);
  if (!s) return null;
  const next = { ...s, ...patch };
  sessions.set(sid, next);
  persist();
  return next;
}

export const PERSONA_LABELS: Record<Persona, string> = {
  researcher: "Researcher",
  product_manager: "Product Manager",
  content_creator: "Content Creator",
};