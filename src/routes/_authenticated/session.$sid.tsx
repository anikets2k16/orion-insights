import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as unknown as { from: (table: string) => any };
import {
  PIPELINE,
  getSession,
  PERSONA_LABELS,
  updateSession,
  type Phase,
  type Source,
  type SessionState,
  type Contradiction,
} from "../../lib/research";
import {
  deepenResearch,
  findContradictions,
  generateAnalysis,
  generateInsights,
  generateReport,
  generateSources,
  identifyGaps,
  runGuardrail,
} from "../../lib/research.functions";

export const Route = createFileRoute("/_authenticated/session/$sid")({
  head: ({ params }) => ({
    meta: [
      { title: `Session ${params.sid} — ORION Insights` },
      { name: "description", content: "Live research pipeline view and source curation." },
      { property: "og:title", content: "ORION Research Session" },
      { property: "og:description", content: "Watch the agents work and curate the sources." },
    ],
  }),
  loader: ({ params }) => ({ sid: params.sid }),
  notFoundComponent: () => (
    <div className="orion-card">
      <h1 className="orion-grad">Session not found</h1>
      <p className="orion-muted">This research session has expired or never existed.</p>
      <Link to="/" className="orion-btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
        Start a new one
      </Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="orion-card">
      <h1 className="orion-grad">Something went wrong</h1>
      <p className="orion-muted">{error.message}</p>
      <button className="orion-btn-primary" onClick={reset}>Try again</button>
    </div>
  ),
  component: SessionPage,
});

function SessionPage() {
  const { sid } = Route.useParams();
  const [session, setSession] = useState<SessionState | null>(() => getSession(sid));
  const [savedReport, setSavedReport] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const startedRef = useRef(false);

  const callSources = useServerFn(generateSources);
  const callAnalysis = useServerFn(generateAnalysis);
  const callContradictions = useServerFn(findContradictions);
  const callInsights = useServerFn(generateInsights);
  const callGaps = useServerFn(identifyGaps);
  const callDeepen = useServerFn(deepenResearch);
  const callGuardrail = useServerFn(runGuardrail);
  const callReport = useServerFn(generateReport);

  function patch(p: Partial<SessionState>) {
    const next = updateSession(sid, p);
    if (next) setSession(next);
  }

  // Load a saved report if revisiting a past session that isn't in local cache.
  useEffect(() => {
    if (session) return;
    (async () => {
      const { data } = await supabase
        .from("research_sessions")
        .select("report_html")
        .eq("id", sid)
        .maybeSingle();
      if (data?.report_html) setSavedReport(data.report_html);
    })();
  }, [session, sid]);

  // Phase 1: intake -> retrieve sources (auto on mount)
  useEffect(() => {
    if (!session || session.sources || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      setRunning(true);
      try {
        patch({ phase: "clarify" });
        await wait(400);
        patch({ phase: "retrieve" });
        const sources = await callSources({
          data: {
            topic: session.topic,
            persona: session.persona,
            threshold: session.threshold,
          },
        });
        patch({ phase: "score", sources: sources as Source[] });
      } catch (e) {
        setError(messageOf(e));
      } finally {
        setRunning(false);
      }
    })();
  }, [session?.sid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitCuration() {
    if (!session?.sources) return;
    const urls = Object.keys(selected).filter((u) => selected[u]);
    if (urls.length === 0) {
      setError("Pick at least one source to continue.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      patch({ curated: urls, phase: "analyse" });
      const chosen = session.sources.filter((s) => urls.includes(s.url));
      const { analysis } = await callAnalysis({
        data: { topic: session.topic, persona: session.persona, sources: chosen },
      });
      patch({ analysis, phase: "contradict" });
      const contradictions = (await callContradictions({
        data: { topic: session.topic, sources: chosen },
      })) as Contradiction[];
      patch({ contradictions, phase: "insight" });
      const insights = await callInsights({
        data: { topic: session.topic, persona: session.persona, analysis, contradictions },
      });
      patch({ insights, phase: "gaps" });

      // Multi-hop: ask for gap queries, then retrieve more.
      const gaps = await callGaps({
        data: { topic: session.topic, analysis, insights },
      });
      let followups: Source[] = [];
      if (gaps.length > 0) {
        patch({ gaps, phase: "deepen" });
        const startCitation = (chosen[chosen.length - 1]?.citation ?? chosen.length) + 1;
        const extra = await callDeepen({ data: { queries: gaps, startCitation } });
        followups = extra as Source[];
        patch({ followups, phase: "guardrail" });
      } else {
        patch({ gaps: [], phase: "guardrail" });
      }

      const guardrail = await callGuardrail({ data: { insights } });
      patch({ guardrail, phase: "report" });
      if (!guardrail.pass) {
        setError(`Guardrail blocked: ${guardrail.reason}`);
        return;
      }
      const allSources = [...chosen, ...followups];
      const { markdown } = await callReport({
        data: {
          topic: session.topic,
          persona: session.persona,
          analysis,
          insights,
          contradictions,
          sources: allSources,
        },
      });
      patch({ report: markdown });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setRunning(false);
    }
  }

  if (!session) {
    return (
      <main>
        <div className="orion-card">
          <h1 className="orion-grad">Loading…</h1>
        </div>
      </main>
    );
  }

  const phaseIdx = PIPELINE.indexOf(session.phase);
  const progress = session.report
    ? 1
    : Math.min(0.98, (phaseIdx + (running ? 0.5 : 1)) / PIPELINE.length);

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Research Session</h1>
        <p className="orion-muted" style={{ wordBreak: "break-all" }}>
          {sid}
          {" · "}
          <span style={{ color: "var(--orion-blue)" }}>{PERSONA_LABELS[session.persona]}</span>
          {" · threshold "}
          {session.threshold.toFixed(2)}
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Topic:</strong> {session.topic}
        </p>

        <div className="orion-progress" aria-label="Pipeline progress">
          <div style={{ width: `${progress * 100}%` }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PIPELINE.map((p, i) => (
            <span key={p} className={"orion-tag" + (i < phaseIdx || session.report ? " sel" : i === phaseIdx ? " sel" : "")}>
              {p}
            </span>
          ))}
        </div>

        {running && (
          <p style={{ marginTop: 14 }} className="orion-muted">
            Agent <strong>{session.phase}</strong> working…
          </p>
        )}
        {error && (
          <p style={{ marginTop: 14, color: "#ff7a90" }}>{error}</p>
        )}
      </section>

      {session.sources && !session.curated && (
        <section className="orion-card">
          <h2>
            Source curation <span className="orion-muted">— your decision</span>
          </h2>
          {session.sources.map((s) => (
            <div className="orion-src" key={s.url}>
              <span className="score">{s.confidence.toFixed(2)}</span>
              <label style={{ flex: 1, margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", marginRight: 8, verticalAlign: "middle" }}
                  checked={!!selected[s.url]}
                  onChange={(e) =>
                    setSelected({ ...selected, [s.url]: e.target.checked })
                  }
                />
                <span className="orion-muted" style={{ marginRight: 6 }}>[{s.citation}]</span>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>{" "}
                <span className="orion-tag">{s.source_type}</span>
                {s.rationale && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 13 }}>
                    {s.rationale}
                  </div>
                )}
                {s.snippet && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 12, fontStyle: "italic" }}>
                    "{s.snippet.slice(0, 220)}…"
                  </div>
                )}
              </label>
            </div>
          ))}
          <button className="orion-btn-primary" onClick={submitCuration} disabled={running}>
            {running ? "Working…" : "Use selected sources & continue"}
          </button>
        </section>
      )}

      {session.contradictions && session.contradictions.length > 0 && (
        <section className="orion-card">
          <h2>Contradictions</h2>
          {session.contradictions.map((c, i) => (
            <div key={i} className="orion-src" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <strong>{c.claim}</strong>
              <p style={{ margin: "6px 0 4px" }}>{c.sides}</p>
              <p className="orion-muted" style={{ margin: 0, fontSize: 13 }}>
                Cites: [{c.citations.join(", ")}]
              </p>
            </div>
          ))}
        </section>
      )}

      {session.gaps && session.gaps.length > 0 && (
        <section className="orion-card">
          <h2>Multi-hop follow-ups</h2>
          <p className="orion-muted">Gaps the agent re-queried the web for:</p>
          <ul>
            {session.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          {session.followups && session.followups.length > 0 && (
            <>
              <h3 style={{ marginTop: 12 }}>New sources discovered</h3>
              {session.followups.map((s) => (
                <div className="orion-src" key={s.url}>
                  <span className="score">[{s.citation}]</span>
                  <a href={s.url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
                    {s.title}
                  </a>
                  <span className="orion-tag">{s.source_type}</span>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {session.insights && (
        <section className="orion-card">
          <h2>Insights</h2>
          {session.insights.map((i, idx) => (
            <div key={idx} className="orion-src" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="score">{i.confidence.toFixed(2)}</span>
                <strong>{i.title}</strong>
                {i.citations && i.citations.length > 0 && (
                  <span className="orion-muted" style={{ fontSize: 12 }}>
                    [{i.citations.join(", ")}]
                  </span>
                )}
              </div>
              <p style={{ margin: "6px 0 4px" }}>{i.summary}</p>
              <p className="orion-muted" style={{ margin: 0, fontSize: 13 }}>
                <strong>Implications:</strong> {i.implications}
              </p>
            </div>
          ))}
        </section>
      )}

      {session.report && (
        <section className="orion-card">
          <h2>Report</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
            {session.report}
          </pre>
        </section>
      )}
    </main>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}