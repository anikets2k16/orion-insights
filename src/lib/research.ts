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
}

export interface SessionState {
  sid: string;
  topic: string;
  persona: Persona;
  threshold: number;
  startedAt: number;
  curated?: string[];
}

export interface SessionStatus {
  sid: string;
  status: "queued" | "running" | "complete";
  progress: number;
  current_phase: Phase;
  report_url?: string;
}

const DURATION_MS = 18_000;
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
  };
  sessions.set(sid, state);
  persist();
  return state;
}

export function getSession(sid: string): SessionState | null {
  hydrate();
  return sessions.get(sid) ?? null;
}

export function getStatus(sid: string): SessionStatus | null {
  const s = getSession(sid);
  if (!s) return null;
  const elapsed = Date.now() - s.startedAt;
  const progress = Math.min(1, elapsed / DURATION_MS);
  const idx = Math.min(PIPELINE.length - 1, Math.floor(progress * PIPELINE.length));
  const phase = PIPELINE[idx];
  return {
    sid,
    status: progress >= 1 ? "complete" : "running",
    progress,
    current_phase: phase,
    report_url: progress >= 1 ? `#/reports/${sid}` : undefined,
  };
}

function hashTopic(topic: string): number {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) {
    h ^= topic.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const DOMAINS = [
  { d: "nature.com", type: "academic" as const },
  { d: "arxiv.org", type: "academic" as const },
  { d: "mckinsey.com", type: "report" as const },
  { d: "techcrunch.com", type: "news" as const },
  { d: "stratechery.com", type: "blog" as const },
  { d: "hbr.org", type: "report" as const },
  { d: "wired.com", type: "news" as const },
  { d: "a16z.com", type: "blog" as const },
];

export function getSources(sid: string): Source[] {
  const s = getSession(sid);
  if (!s) return [];
  const base = hashTopic(s.topic + s.persona);
  return DOMAINS.slice(0, 6).map((entry, i) => {
    const slug = s.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "research";
    const confidence = 0.55 + (((base >> (i * 3)) & 0x1f) / 31) * 0.42;
    return {
      url: `https://${entry.d}/${slug}-${i + 1}`,
      title: titleCase(`${s.topic} — perspective ${i + 1} on ${entry.d.split(".")[0]}`),
      source_type: entry.type,
      confidence: Number(confidence.toFixed(2)),
    };
  });
}

function titleCase(s: string) {
  return s
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function curate(sid: string, urls: string[]): number {
  const s = getSession(sid);
  if (!s) return 0;
  s.curated = urls;
  sessions.set(sid, s);
  persist();
  return urls.length;
}

export const PERSONA_LABELS: Record<Persona, string> = {
  researcher: "Researcher",
  product_manager: "Product Manager",
  content_creator: "Content Creator",
};