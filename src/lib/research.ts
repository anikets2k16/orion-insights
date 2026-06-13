import { analyseAndSynthesize, retrieveAndScoreSources } from "./research.functions";

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

export interface Gap {
  question: string;
  why_it_matters: string;
  suggested_next_step: string;
}

export interface Analysis {
  themes: string[];
  tensions: string[];
  narrative: string;
}

/**
 * Structured report output — mirrors a Pydantic BaseModel on the backend.
 * The HTML view is derived from this object; downstream consumers can also
 * read the typed object directly.
 */
export interface Report {
  topic: string;
  persona: Persona;
  threshold: number;
  executive_summary: string;
  analysis: Analysis;
  insights: Insight[];
  contradictions: Contradiction[];
  gaps: Gap[];
  sources: Source[];
  generated_at: string;
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
  analysis?: Analysis;
  insights?: Insight[];
  contradictions?: Contradiction[];
  gaps?: Gap[];
  report?: Report;
  executiveSummary?: string;
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

function mockAnalysis(topic: string, persona: Persona): Analysis {
  return {
    themes: [
      `Maturity of ${topic} across academic and industry sources`,
      `Gap between vendor claims and independent evaluation`,
      `Practitioner tooling as the limiting factor`,
    ],
    tensions: [
      `Bullish industry coverage vs. skeptical independent reviews`,
      `Reported gains vs. replicated benchmarks`,
    ],
    narrative:
      `Across the curated corpus, ${topic} is moving from research into production, ` +
      `but the ${PERSONA_LABELS[persona].toLowerCase()} should weight independent evidence ` +
      `over vendor narratives when deciding next steps.`,
  };
}

function mockGaps(topic: string): Gap[] {
  return [
    {
      question: `What does independent replication of headline ${topic} results look like at scale?`,
      why_it_matters: `Most reported gains come from vendor-controlled benchmarks.`,
      suggested_next_step: `Commission a small internal benchmark on representative workloads.`,
    },
    {
      question: `Which sub-segments of ${topic} have durable tooling?`,
      why_it_matters: `Tooling, not capability, is the cited bottleneck.`,
      suggested_next_step: `Map the current tooling landscape and rate maturity.`,
    },
  ];
}

function buildReportObject(state: SessionState): Report {
  const sources = (state.sources ?? []).filter((s) => !state.curated || state.curated.includes(s.url));
  const insights = state.insights ?? [];
  const analysis = state.analysis ?? mockAnalysis(state.topic, state.persona);
  return {
    topic: state.topic,
    persona: state.persona,
    threshold: state.threshold,
    executive_summary: state.executiveSummary ??
      `This report synthesises ${sources.length} curated source${sources.length === 1 ? "" : "s"} on ` +
      `${state.topic} through a ${PERSONA_LABELS[state.persona].toLowerCase()} lens, surfacing ` +
      `${insights.length} insights, ${(state.contradictions ?? []).length} contradiction(s), and ` +
      `${(state.gaps ?? []).length} open question(s).`,
    analysis,
    insights,
    contradictions: state.contradictions ?? [],
    gaps: state.gaps ?? [],
    sources,
    generated_at: new Date().toISOString(),
  };
}

function renderReportHtml(r: Report): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const persona = PERSONA_LABELS[r.persona];
  return `
    <article style="line-height:1.6">
      <p><em>Persona: ${esc(persona)} · confidence threshold ${r.threshold.toFixed(2)} · ${r.sources.length} sources</em></p>
      <h3>Executive summary</h3>
      <p>${esc(r.executive_summary)}</p>
      <h3>Analysis</h3>
      <p>${esc(r.analysis.narrative)}</p>
      <p><strong>Themes:</strong></p>
      <ul>${r.analysis.themes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p><strong>Tensions:</strong></p>
      <ul>${r.analysis.tensions.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <h3>Key insights</h3>
      <ol>${r.insights.map((i) => `<li><strong>${esc(i.title)}</strong> — ${esc(i.summary)} <em>Implications:</em> ${esc(i.implications)} <span style="opacity:.7">[${(i.citations ?? []).join(", ")}]</span></li>`).join("")}</ol>
      <h3>Contradictions</h3>
      <ul>${r.contradictions.map((c) => `<li><strong>${esc(c.claim)}</strong> — ${esc(c.sides)} <span style="opacity:.7">[${c.citations.join(", ")}]</span></li>`).join("")}</ul>
      <h3>Open questions &amp; gaps</h3>
      <ul>${r.gaps.map((g) => `<li><strong>${esc(g.question)}</strong> — ${esc(g.why_it_matters)} <em>Next:</em> ${esc(g.suggested_next_step)}</li>`).join("")}</ul>
      <h3>Sources</h3>
      <ol>${r.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.title)}</a> — <span style="opacity:.7">${s.source_type}, confidence ${s.confidence.toFixed(2)}</span></li>`).join("")}</ol>
      <p style="opacity:.6;margin-top:24px;font-size:13px">Generated ${esc(r.generated_at)} — ORION simulated pipeline.</p>
    </article>
  `.trim();
}

const PHASE_MS = 700;

/**
 * Background promises keyed by sid for in-flight retrieval/synthesis calls.
 * The phase ticker waits on these before advancing past their gating phase.
 */
const retrievalPromises = new Map<string, Promise<void>>();
const synthesisPromises = new Map<string, Promise<void>>();

async function runRetrieval(sid: string) {
  const s = sessions.get(sid);
  if (!s) return;
  try {
    const { sources } = await retrieveAndScoreSources({
      data: { topic: s.topic, persona: s.persona, threshold: s.threshold },
    });
    updateSession(sid, { sources });
  } catch (e) {
    updateSession(sid, {
      error: `Retrieval failed: ${e instanceof Error ? e.message : String(e)}`,
      sources: [],
    });
  }
}

async function runSynthesis(sid: string) {
  const s = sessions.get(sid);
  if (!s) return;
  const sources = (s.sources ?? []).filter((src) => !s.curated || s.curated.includes(src.url));
  if (sources.length === 0) {
    updateSession(sid, { error: "No sources selected for synthesis." });
    return;
  }
  try {
    const out = await analyseAndSynthesize({
      data: {
        topic: s.topic,
        persona: s.persona,
        threshold: s.threshold,
        sources: sources.map((src) => ({
          url: src.url,
          title: src.title,
          source_type: src.source_type,
          confidence: src.confidence,
          snippet: src.snippet,
          citation: src.citation,
        })),
      },
    });
    updateSession(sid, {
      analysis: out.analysis,
      insights: out.insights,
      contradictions: out.contradictions,
      gaps: out.gaps,
      executiveSummary: out.executive_summary,
      report: undefined,
    });
  } catch (e) {
    updateSession(sid, {
      error: `Synthesis failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

function schedule(sid: string) {
  if (typeof window === "undefined") return;
  const tick = () => {
    const s = sessions.get(sid);
    if (!s) return;
    const idx = PIPELINE.indexOf(s.phase);
    // Pause at 'score' for user curation — and only once retrieval is done.
    if (s.phase === "score" && !s.curated) {
      // Wait for retrieval to complete before exposing sources for curation.
      const p = retrievalPromises.get(sid);
      if (p) {
        p.then(() => window.setTimeout(tick, 200));
        retrievalPromises.delete(sid);
        updateSession(sid, { status: "running" });
        return;
      }
      updateSession(sid, { status: "awaiting_curation", progress: (idx + 1) / PIPELINE.length });
      return;
    }
    // Once curated, we need the synthesis to land before showing analyse/insight/etc.
    if (s.phase === "score" && s.curated) {
      const p = synthesisPromises.get(sid);
      if (p) {
        p.then(() => window.setTimeout(tick, 200));
        synthesisPromises.delete(sid);
        return;
      }
    }
    if (idx >= PIPELINE.length - 1) {
      const completed = updateSession(sid, { status: "complete", progress: 1 });
      if (completed) {
        const report = buildReportObject(completed);
        updateSession(sid, { report, reportHtml: renderReportHtml(report) });
      }
      return;
    }
    const next = PIPELINE[idx + 1];
    const patch: Partial<SessionState> = {
      phase: next,
      progress: (idx + 1) / PIPELINE.length,
      status: "running",
    };
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
  // Fire real retrieval immediately so it's likely ready by the time the
  // ticker reaches the 'score' phase.
  retrievalPromises.set(sid, runRetrieval(sid));
  schedule(sid);
  return state;
}

/** Continue the pipeline after the user submits curated sources. */
export function continueAfterCuration(sid: string, urls: string[]): SessionState | null {
  const s = getSession(sid);
  if (!s) return null;
  const next = updateSession(sid, { curated: urls, status: "running" });
  if (next) {
    synthesisPromises.set(sid, runSynthesis(sid));
    schedule(sid);
  }
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