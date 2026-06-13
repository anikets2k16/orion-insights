/**
 * ORION research flow — client-side simulated pipeline.
 *
 * This is the Lovable demo mock. It mimics the FastAPI backend in api/ + agents/
 * by progressing a session through deterministic phases on a timer, generating
 * plausible sources and an HTML report. State is held in-memory and mirrored to
 * localStorage so reloads keep the session.
 */
export const PIPELINE = [
  "intake",
  "clarify",
  "retrieve",
  "score",
  "analyse",
  "contradict",
  "insight",
  "gaps",
  "deepen",
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
  snippet?: string;
  citation?: number;
  hop?: number;
}

export interface Insight {
  title: string;
  summary: string;
  implications: string;
  confidence: number;
  citations?: number[];
}

export interface Contradiction {
  claim: string;
  sides: string;
  citations: number[];
}

export interface SessionState {
  sid: string;
  topic: string;
  persona: Persona;
  threshold: number;
  startedAt: number;
  phase: Phase;
  progress?: number;
  sources?: Source[];
  curated?: string[];
  insights?: Insight[];
  contradictions?: Contradiction[];
  reportHtml?: string;
  error?: string;
  status?: "queued" | "running" | "awaiting_curation" | "complete";
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

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function mockSources(topic: string, threshold: number): Source[] {
  const t = topic.trim();
  const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const seed = hash(t);
  const raw: Source[] = [
    {
      url: `https://arxiv.org/abs/${seed.slice(0, 4)}.${seed.slice(4, 8)}`,
      title: `A systematic review of ${t}`,
      source_type: "academic",
      confidence: 0.92,
      rationale: "Peer-reviewed, recent, directly on-topic.",
      snippet: `This review synthesises 47 studies on ${t}, finding consistent evidence across methodologies.`,
      citation: 1,
    },
    {
      url: `https://www.nature.com/articles/${slug}-2026`,
      title: `${t}: state of the field in 2026`,
      source_type: "academic",
      confidence: 0.88,
      rationale: "Authoritative venue with strong editorial review.",
      snippet: `We report new benchmarks for ${t} and identify three open problems.`,
      citation: 2,
    },
    {
      url: `https://www.reuters.com/technology/${slug}/`,
      title: `Industry adoption of ${t} accelerates`,
      source_type: "news",
      confidence: 0.78,
      rationale: "Reputable newswire, corroborated by multiple outlets.",
      snippet: `Major firms have begun production deployments of ${t} in the past 18 months.`,
      citation: 3,
    },
    {
      url: `https://www.mckinsey.com/insights/${slug}`,
      title: `The economics of ${t}`,
      source_type: "report",
      confidence: 0.74,
      rationale: "Methodology disclosed; data partly proprietary.",
      snippet: `Estimated TAM grows at 23% CAGR through 2030, driven by ${t}.`,
      citation: 4,
    },
    {
      url: `https://blog.example.com/${slug}-explained`,
      title: `${t} explained for builders`,
      source_type: "blog",
      confidence: 0.61,
      rationale: "Useful framing, but single author and limited citations.",
      snippet: `A practitioner walkthrough of how ${t} actually works in production.`,
      citation: 5,
    },
    {
      url: `https://www.economist.com/${slug}-skeptics`,
      title: `Why some experts are skeptical of ${t}`,
      source_type: "news",
      confidence: 0.69,
      rationale: "Balances bullish coverage with credible dissent.",
      snippet: `Critics argue reported gains in ${t} have not survived independent replication.`,
      citation: 6,
    },
  ];
  return raw.filter((s) => s.confidence >= threshold);
}

function mockInsights(topic: string, persona: Persona): Insight[] {
  const lens = {
    researcher: "evidence base",
    product_manager: "opportunity space",
    content_creator: "narrative hook",
  }[persona];
  return [
    {
      title: `Consensus is forming around ${topic}`,
      summary: `Across peer-reviewed and industry sources, the ${lens} for ${topic} is converging.`,
      implications: `Plan against this becoming a default assumption in 12–18 months.`,
      confidence: 0.86,
      citations: [1, 2, 4],
    },
    {
      title: `Adoption outpaces evaluation`,
      summary: `Deployments of ${topic} are scaling faster than independent benchmarks track.`,
      implications: `Expect a correction cycle once rigorous evaluations land.`,
      confidence: 0.72,
      citations: [3, 6],
    },
    {
      title: `Tooling is the bottleneck`,
      summary: `Practitioners cite tooling — not capability — as the main constraint on ${topic}.`,
      implications: `A focused tooling play has a credible wedge.`,
      confidence: 0.68,
      citations: [5],
    },
  ];
}

function mockContradictions(topic: string): Contradiction[] {
  return [
    {
      claim: `Whether ${topic} delivers reported gains in real deployments`,
      sides: `Vendor-reported case studies show large wins; independent reviews show smaller, uneven effects.`,
      citations: [3, 6],
    },
  ];
}

function buildReport(state: SessionState): string {
  const srcs = (state.sources ?? []).filter((s) => !state.curated || state.curated.includes(s.url));
  const insights = state.insights ?? [];
  const contras = state.contradictions ?? [];
  const persona = PERSONA_LABELS[state.persona];
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  return `
    <article style="line-height:1.6">
      <p><em>Persona: ${esc(persona)} · confidence threshold ${state.threshold.toFixed(2)} · ${srcs.length} sources</em></p>
      <h3>Executive summary</h3>
      <p>This report synthesises ${srcs.length} curated sources on <strong>${esc(state.topic)}</strong> through a ${esc(persona.toLowerCase())} lens. It surfaces ${insights.length} insights and ${contras.length} contradiction${contras.length === 1 ? "" : "s"} flagged during analysis.</p>
      <h3>Key insights</h3>
      <ol>${insights.map((i) => `<li><strong>${esc(i.title)}</strong> — ${esc(i.summary)} <em>Implications:</em> ${esc(i.implications)} <span style="opacity:.7">[${(i.citations ?? []).join(", ")}]</span></li>`).join("")}</ol>
      <h3>Contradictions</h3>
      <ul>${contras.map((c) => `<li><strong>${esc(c.claim)}</strong> — ${esc(c.sides)} <span style="opacity:.7">[${c.citations.join(", ")}]</span></li>`).join("")}</ul>
      <h3>Sources</h3>
      <ol>${srcs.map((s) => `<li><a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.title)}</a> — <span style="opacity:.7">${s.source_type}, confidence ${s.confidence.toFixed(2)}</span></li>`).join("")}</ol>
      <p style="opacity:.6;margin-top:24px;font-size:13px">Demo report generated by the ORION simulated pipeline.</p>
    </article>
  `.trim();
}

const PHASE_MS = 700;

function schedule(sid: string) {
  if (typeof window === "undefined") return;
  const tick = () => {
    const s = sessions.get(sid);
    if (!s) return;
    const idx = PIPELINE.indexOf(s.phase);
    // Pause at 'score' for user curation.
    if (s.phase === "score" && !s.curated) {
      updateSession(sid, { status: "awaiting_curation", progress: (idx + 1) / PIPELINE.length });
      return;
    }
    if (idx >= PIPELINE.length - 1) {
      const withReport = updateSession(sid, { status: "complete", progress: 1 });
      if (withReport) updateSession(sid, { reportHtml: buildReport(withReport) });
      return;
    }
    const next = PIPELINE[idx + 1];
    const patch: Partial<SessionState> = {
      phase: next,
      progress: (idx + 1) / PIPELINE.length,
      status: "running",
    };
    if (next === "score") patch.sources = mockSources(s.topic, s.threshold);
    if (next === "insight") patch.insights = mockInsights(s.topic, s.persona);
    if (next === "contradict") patch.contradictions = mockContradictions(s.topic);
    updateSession(sid, patch);
    window.setTimeout(tick, PHASE_MS);
  };
  window.setTimeout(tick, PHASE_MS);
}

export async function startResearch(input: {
  topic: string;
  persona: Persona;
  threshold: number;
  selected_agent_models?: Record<string, string>;
}): Promise<SessionState> {
  hydrate();
  const sid = `orion-${hash(input.topic + "|" + input.persona + "|" + input.threshold)}-${Date.now().toString(36)}`;
  const state: SessionState = {
    sid,
    topic: input.topic,
    persona: input.persona,
    threshold: input.threshold,
    startedAt: Date.now(),
    phase: "intake",
    progress: 0,
    status: "running",
  };
  sessions.set(sid, state);
  persist();
  schedule(sid);
  return state;
}

/** Continue the pipeline after the user submits curated sources. */
export function continueAfterCuration(sid: string, urls: string[]): SessionState | null {
  const s = getSession(sid);
  if (!s) return null;
  const next = updateSession(sid, { curated: urls, status: "running" });
  if (next) schedule(sid);
  return next;
}

/** Rehydrate and resume any in-flight sessions after a page reload. */
export function resumeInFlight() {
  hydrate();
  sessions.forEach((s) => {
    if (s.status === "running" && s.phase !== "report") schedule(s.sid);
  });
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