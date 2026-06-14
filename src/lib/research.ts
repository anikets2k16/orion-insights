import { analyseAndSynthesize, retrieveAndScoreSources } from "./research.functions";
import type {
  Analysis,
  Contradiction,
  Gap,
  Insight,
  Persona,
  Source,
} from "./research.types";

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

function isNonEmptyText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values: string[] | undefined, fallback: string[] = []): string[] {
  const cleaned = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  return cleaned.length > 0 ? cleaned : [...fallback];
}

function uniqueNumbers(values: number[] | undefined): number[] {
  return [...new Set((values ?? []).filter((value) => Number.isFinite(value)).map((value) => Number(value)))];
}

function selectedSources(state: Pick<SessionState, "sources" | "curated">): Source[] {
  return (state.sources ?? []).filter((source) => !state.curated || state.curated.includes(source.url));
}

function buildFallbackAnalysis(topic: string, persona: Persona, sources: Source[]): Analysis {
  if (sources.length === 0) return mockAnalysis(topic, persona);

  const ranked = [...sources].sort((a, b) => b.confidence - a.confidence);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const types = uniqueStrings(sources.map((source) => source.source_type));

  return {
    themes: uniqueStrings([
      `The evidence base spans ${types.join(", ")} coverage`,
      `${sources.length} curated source${sources.length === 1 ? "" : "s"} shape the working view of ${topic}`,
      `The strongest signal comes from ${strongest.title}`,
    ]).slice(0, 3),
    tensions: uniqueStrings([
      `Confidence ranges from ${Math.round(weakest.confidence * 100)}% to ${Math.round(strongest.confidence * 100)}% across the corpus`,
      types.length > 1
        ? `Different source types frame ${topic} with different levels of rigor and certainty`
        : `Cross-validation across independent source types is still limited`,
    ]).slice(0, 3),
    narrative:
      `The curated evidence on ${topic} is directionally useful but uneven in strength. ` +
      `For the ${PERSONA_LABELS[persona].toLowerCase()}, the most defensible conclusions should anchor on ` +
      `high-confidence sources like “${strongest.title}” while treating lower-confidence claims as directional rather than settled.`,
  };
}

function buildFallbackInsights(topic: string, persona: Persona, sources: Source[]): Insight[] {
  if (sources.length === 0) return mockInsights(topic, persona);

  const ranked = [...sources].sort((a, b) => b.confidence - a.confidence);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const types = uniqueStrings(sources.map((source) => source.source_type));
  const averageConfidence = ranked.reduce((sum, source) => sum + source.confidence, 0) / ranked.length;
  const leadCitations = uniqueNumbers(ranked.slice(0, 3).map((source) => source.citation ?? 0));

  return [
    {
      title: "Highest-confidence evidence anchors the narrative",
      summary: `${strongest.title} is the strongest source in the curated set at ${Math.round(strongest.confidence * 100)}% confidence and should carry the most decision weight.`,
      implications: `Base the ${PERSONA_LABELS[persona].toLowerCase()} recommendation on claims supported by the top-ranked evidence first.`,
      confidence: strongest.confidence,
      citations: uniqueNumbers([strongest.citation ?? 0]),
    },
    {
      title: types.length > 1 ? "Coverage is triangulated across source types" : "Coverage is still concentrated in one source type",
      summary: `The current evidence combines ${types.join(", ")} perspectives, giving a clearer view of where ${topic} is substantiated versus still speculative.`,
      implications: "Prioritize claims that appear consistently across more than one source format, not just within a single narrative style.",
      confidence: Math.max(0.45, Math.min(1, averageConfidence)),
      citations: leadCitations,
    },
    {
      title: "Weaker evidence marks the validation frontier",
      summary: `${weakest.title} sits at the lower-confidence end of the set, showing where the present story is least reliable or most incomplete.`,
      implications: `Treat adjacent claims as hypotheses until stronger corroboration arrives for ${topic}.`,
      confidence: Math.max(0.35, weakest.confidence),
      citations: uniqueNumbers([weakest.citation ?? 0]),
    },
  ];
}

function buildFallbackContradictions(topic: string, sources: Source[]): Contradiction[] {
  if (sources.length < 2) return [];

  const ranked = [...sources].sort((a, b) => b.confidence - a.confidence);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const types = uniqueStrings(sources.map((source) => source.source_type));

  if (strongest.url === weakest.url && types.length < 2) return [];
  if (strongest.confidence - weakest.confidence < 0.12 && types.length < 2) return [];

  return [
    {
      claim: `How confidently ${topic} is supported by the current evidence base`,
      sides: `${strongest.title} provides the strongest backing, while ${weakest.title} is materially less reliable or narrower in scope.`,
      citations: uniqueNumbers([strongest.citation ?? 0, weakest.citation ?? 0]),
    },
  ];
}

function buildFallbackGaps(topic: string, sources: Source[]): Gap[] {
  if (sources.length === 0) return mockGaps(topic);

  const types = uniqueStrings(sources.map((source) => source.source_type));
  const nextEvidenceTarget = !types.includes("academic")
    ? "peer-reviewed or primary research"
    : !types.includes("report")
      ? "benchmark and industry report coverage"
      : !types.includes("news")
        ? "recent deployment reporting"
        : "implementation-level case studies";

  return [
    {
      question: `Which claims about ${topic} still lack independent replication?`,
      why_it_matters: "The strongest story is only as durable as the evidence that can be repeated outside a single source or narrative frame.",
      suggested_next_step: `Add ${nextEvidenceTarget} focused on replicable outcomes, benchmarks, or primary observations.`,
    },
    {
      question: `Where does the present evidence on ${topic} remain operationally thin?`,
      why_it_matters: `The current source mix covers ${types.join(", ")}, but it does not fully resolve implementation constraints, edge cases, or failure modes.`,
      suggested_next_step: "Target a follow-up pass on deployment details, limitations, and real-world counterexamples.",
    },
  ];
}

export function normalizeSessionOutputs(state: Pick<SessionState, "topic" | "persona" | "sources" | "curated" | "analysis" | "insights" | "contradictions" | "gaps" | "executiveSummary">) {
  const sources = selectedSources(state);
  const fallbackAnalysis = buildFallbackAnalysis(state.topic, state.persona, sources);
  const rawAnalysis = state.analysis;

  const analysis: Analysis = {
    themes: uniqueStrings(rawAnalysis?.themes, fallbackAnalysis.themes).slice(0, 4),
    tensions: uniqueStrings(rawAnalysis?.tensions, fallbackAnalysis.tensions).slice(0, 4),
    narrative: isNonEmptyText(rawAnalysis?.narrative) ? rawAnalysis.narrative.trim() : fallbackAnalysis.narrative,
  };

  const insights = (state.insights ?? [])
    .map((insight) => ({
      title: insight.title?.trim() ?? "",
      summary: insight.summary?.trim() ?? "",
      implications: insight.implications?.trim() ?? "",
      confidence: Math.max(0, Math.min(1, Number(insight.confidence) || 0)),
      citations: uniqueNumbers(insight.citations),
    }))
    .filter((insight) => isNonEmptyText(insight.title) && isNonEmptyText(insight.summary) && isNonEmptyText(insight.implications));

  const contradictions = (state.contradictions ?? [])
    .map((contradiction) => ({
      claim: contradiction.claim?.trim() ?? "",
      sides: contradiction.sides?.trim() ?? "",
      citations: uniqueNumbers(contradiction.citations),
    }))
    .filter((contradiction) => isNonEmptyText(contradiction.claim) && isNonEmptyText(contradiction.sides));

  const gaps = (state.gaps ?? [])
    .map((gap) => ({
      question: gap.question?.trim() ?? "",
      why_it_matters: gap.why_it_matters?.trim() ?? "",
      suggested_next_step: gap.suggested_next_step?.trim() ?? "",
    }))
    .filter((gap) => isNonEmptyText(gap.question) && isNonEmptyText(gap.why_it_matters) && isNonEmptyText(gap.suggested_next_step));

  const normalizedInsights = insights.length > 0 ? insights : buildFallbackInsights(state.topic, state.persona, sources);
  const normalizedContradictions = contradictions.length > 0 ? contradictions : buildFallbackContradictions(state.topic, sources);
  const normalizedGaps = gaps.length > 0 ? gaps : buildFallbackGaps(state.topic, sources);

  const executiveSummary = isNonEmptyText(state.executiveSummary)
    ? state.executiveSummary.trim()
    : `Using ${sources.length} curated source${sources.length === 1 ? "" : "s"} on ${state.topic}, ` +
      `ORION surfaced ${normalizedInsights.length} insight${normalizedInsights.length === 1 ? "" : "s"}, ` +
      `${normalizedContradictions.length} contradiction${normalizedContradictions.length === 1 ? "" : "s"}, and ` +
      `${normalizedGaps.length} open gap${normalizedGaps.length === 1 ? "" : "s"} for the ${PERSONA_LABELS[state.persona].toLowerCase()}.`;

  return {
    sources,
    executiveSummary,
    analysis,
    insights: normalizedInsights,
    contradictions: normalizedContradictions,
    gaps: normalizedGaps,
  };
}

function buildReportObject(state: SessionState): Report {
  const normalized = normalizeSessionOutputs(state);
  return {
    topic: state.topic,
    persona: state.persona,
    threshold: state.threshold,
    executive_summary: normalized.executiveSummary,
    analysis: normalized.analysis,
    insights: normalized.insights,
    contradictions: normalized.contradictions,
    gaps: normalized.gaps,
    sources: normalized.sources,
    generated_at: new Date().toISOString(),
  };
}

function renderReportHtml(r: Report): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const istTime = new Date(r.generated_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  });
  return `
    <article style="line-height:1.6">
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
      <h3>Deepen</h3>
      <ul>
        <li><strong>Best next evidence move</strong> — ${esc(r.gaps[0]?.suggested_next_step ?? "Expand the source set with tighter primary evidence.")}</li>
        <li><strong>Where to press harder</strong> — ${esc(r.contradictions[0]?.claim ?? r.analysis.tensions[0] ?? "Pressure-test the weakest-supported claims against stronger evidence.")}</li>
      </ul>
      <h3>Guardrails</h3>
      <ul>
        <li><strong>Evidence boundary</strong> — Claims should stay anchored to the curated sources and their cited confidence range.</li>
        <li><strong>Weak-claim watchlist</strong> — ${esc(r.analysis.tensions[0] ?? "Watch for overstated certainty where the evidence base is still mixed.")}</li>
      </ul>
      <h3>Sources</h3>
      <ol>${r.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.title)}</a> — <span style="opacity:.7">${s.source_type}, confidence ${s.confidence.toFixed(2)}</span></li>`).join("")}</ol>
      <p style="opacity:.6;margin-top:24px;font-size:13px">Generated ${esc(istTime)} IST — ORION simulated pipeline.</p>
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
    const result = await retrieveAndScoreSources({
      data: { topic: s.topic, persona: s.persona, threshold: s.threshold },
    });
    const sources = Array.isArray(result?.sources) ? result.sources : [];
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
    const normalized = normalizeSessionOutputs({
      ...s,
      sources,
      analysis: out.analysis,
      insights: out.insights,
      contradictions: out.contradictions,
      gaps: out.gaps,
      executiveSummary: out.executive_summary,
    });
    updateSession(sid, {
      analysis: normalized.analysis,
      insights: normalized.insights,
      contradictions: normalized.contradictions,
      gaps: normalized.gaps,
      executiveSummary: normalized.executiveSummary,
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