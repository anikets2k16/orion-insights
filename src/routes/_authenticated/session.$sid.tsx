import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  FileText,
  HelpCircle,
  Lightbulb,
  Scale,
  Sparkles,
} from "lucide-react";
import { supabase as _supabase } from "@/lib/supabase-browser";
import {
  continueAfterCuration,
  getSession,
  normalizeSessionOutputs,
  PERSONA_LABELS,
  PIPELINE,
  resumeInFlight,
  type SessionState,
} from "@/lib/research";
import { PipelineStepper } from "@/components/PipelineStepper";
import { useProfile } from "@/lib/profile";
import { Download } from "lucide-react";
import {
  CitationChips,
  ConfidenceBar,
  ConfidencePill,
  SectionCard,
} from "@/components/research/ResultPrimitives";
import {
  buildReportPdfBlob,
  downloadBlob,
  safeFilename,
  sanitizeReportHtml,
} from "@/lib/report-pdf.client";

const supabase = _supabase as unknown as { from: (table: string) => any };

export const Route = createFileRoute("/_authenticated/session/$sid")({
  head: ({ params }) => ({
    meta: [
      { title: `Session ${params.sid} — ORION Insights` },
      { name: "description", content: "Live research pipeline view and source curation." },
      { property: "og:title", content: "ORION Research Session" },
      { property: "og:description", content: "Watch the agents work and curate the sources." },
    ],
  }),
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [savedHtml, setSavedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const mirroredRef = useRef(false);
  const profile = useProfile();

  useEffect(() => {
    resumeInFlight();
    const id = window.setInterval(() => {
      const s = getSession(sid);
      setSession(s);
    }, 400);
    return () => window.clearInterval(id);
  }, [sid]);

  useEffect(() => {
    if (session || savedHtml) return;
    (async () => {
      const { data } = await supabase
        .from("research_sessions")
        .select("report_html")
        .eq("id", sid)
        .maybeSingle();
      if (data?.report_html) setSavedHtml(data.report_html);
    })();
  }, [session, sid, savedHtml]);

  useEffect(() => {
    if (!session || mirroredRef.current) return;
    if (session.status !== "complete" || !session.reportHtml) return;
    mirroredRef.current = true;
    supabase
      .from("research_sessions")
      .update({
        status: "complete",
        report_html: session.reportHtml,
        source_count: (session.curated ?? session.sources ?? []).length,
        insight_count: (session.insights ?? []).length,
        contradiction_count: (session.contradictions ?? []).length,
      })
      .eq("id", sid);
  }, [session, sid]);

  async function handleReportDownload(html: string, topic: string) {
    setError(null);
    setIsDownloading(true);

    const popup = window.open("", "_blank", "width=560,height=360");

    try {
      if (popup && !popup.closed) {
        popup.document.title = "Preparing PDF…";
        popup.document.body.innerHTML = `
          <main style="font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; color: #111827;">
            <h1 style="font-size: 20px; margin: 0 0 8px;">Preparing your PDF…</h1>
            <p style="margin: 0; color: #4b5563;">Your download should start automatically in a moment.</p>
          </main>
        `;
      }

      const blob = await buildReportPdfBlob(html, topic);
      const filename = `${safeFilename(topic)}.pdf`;

      if (popup && !popup.closed) {
        const url = URL.createObjectURL(blob);
        const link = popup.document.createElement("a");
        link.href = url;
        link.download = filename;
        popup.document.body.appendChild(link);
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        popup.setTimeout(() => popup.close(), 1200);
      } else {
        downloadBlob(blob, filename);
      }
    } catch {
      if (popup && !popup.closed) {
        popup.close();
      }
      setError("Couldn't download the PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  function submitCuration() {
    if (!session?.sources) return;
    const urls = Object.keys(selected).filter((u) => selected[u]);
    if (urls.length === 0) {
      setError("Pick at least one source to continue.");
      return;
    }
    setError(null);
    const next = continueAfterCuration(sid, urls);
    if (next) setSession(next);
  }

  const progress = useMemo(() => session?.progress ?? 0, [session]);
  const derived = useMemo(
    () => (session ? normalizeSessionOutputs(session) : null),
    [session],
  );
  const reportHtml = useMemo(
    () => (session?.reportHtml ? sanitizeReportHtml(session.reportHtml) : null),
    [session?.reportHtml],
  );
  void PIPELINE;

  if (!session && savedHtml) {
    return (
      <main>
        <section className="orion-card">
          <h1 className="orion-grad">Saved Report</h1>
          <div className="orion-report-frame" dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(savedHtml) }} />
          {error && <p style={{ marginTop: 14, color: "#ff7a90" }}>{error}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="orion-btn-primary"
              onClick={() => {
                void handleReportDownload(sanitizeReportHtml(savedHtml), `report-${sid}`);
              }}
              disabled={isDownloading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> {isDownloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main>
        <div className="orion-card">
          <h1 className="orion-grad">Loading…</h1>
          <p className="orion-muted">
            If this session was started in another browser, only the saved report is available here.
          </p>
          <Link to="/history" className="orion-btn-primary" style={{ display: "inline-block", marginTop: 12 }}>
            Back to history
          </Link>
        </div>
      </main>
    );
  }

  const showCuration = session.status === "awaiting_curation" && session.sources && !session.curated;
  const hasCuratedSources = Array.isArray(session.curated) && session.curated.length > 0;
  const phaseIndex = PIPELINE.indexOf(session.phase);
  const hasCompletedStage = (phase: (typeof PIPELINE)[number]) =>
    session.status === "complete" || (hasCuratedSources && phaseIndex > PIPELINE.indexOf(phase));

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Research Session</h1>
        <p className="orion-muted" style={{ wordBreak: "break-all" }}>
          {profile?.display_name?.trim() || "You"}
          {" · threshold "}
          {session.threshold.toFixed(2)}
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Topic:</strong> {session.topic}
        </p>

        <PipelineStepper phase={session.phase} progress={progress} status={session.status} />

        <p style={{ marginTop: 6 }} className="orion-muted">
          Status: <strong style={{ color: "var(--orion-text)" }}>{session.status ?? "running"}</strong>
        </p>

        {error && <p style={{ marginTop: 14, color: "#ff7a90" }}>{error}</p>}
        {session.error && (
          <p style={{ marginTop: 8, color: "#ff7a90" }}>
            <strong>Pipeline error:</strong> {session.error}
          </p>
        )}
      </section>

      {showCuration && (
        <SectionCard icon={<Sparkles size={16} />} title="Source curation">
          <h2>
            <span className="orion-muted" style={{ fontSize: 13, fontWeight: 400 }}>Your decision · pick the sources to analyse</span>
          </h2>
          {session.sources!.length === 0 && (
            <p className="orion-muted">
              No sources were returned by the retriever. Try a broader topic or a lower confidence threshold.
            </p>
          )}
          {session.sources!.map((s, i) => (
            <motion.div
              className="orion-src"
              key={s.url}
              id={s.citation != null ? `src-${s.citation}` : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <ConfidencePill value={s.confidence} />
              <label style={{ flex: 1, margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", marginRight: 8, verticalAlign: "middle" }}
                  checked={!!selected[s.url]}
                  onChange={(e) => setSelected({ ...selected, [s.url]: e.target.checked })}
                />
                <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                {s.rationale && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 13 }}>{s.rationale}</div>
                )}
                {s.snippet && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 12, fontStyle: "italic" }}>
                    "{s.snippet}"
                  </div>
                )}
              </label>
            </motion.div>
          ))}
          <button
            className="orion-btn-primary"
            onClick={submitCuration}
            disabled={Object.values(selected).filter(Boolean).length === 0}
          >
            Use selected sources &amp; continue
          </button>
        </SectionCard>
      )}

      {session.curated && session.status !== "complete" && (
        <section className="orion-card">
          <h2>Pipeline running</h2>
          <p className="orion-muted">
            {session.curated.length} sources selected. Analysis, contradiction, insight, guardrail,
            and report phases are running.
          </p>
        </section>
      )}

      <AnimatePresence>
        {derived && hasCompletedStage("analyse") && (
          <SectionCard key="analysis" icon={<Brain size={16} />} title="Critical analysis">
            <p style={{ marginTop: 0, lineHeight: 1.65 }}>{derived.analysis.narrative}</p>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
              <div>
                <div className="orion-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Themes</div>
                <div className="orion-cloud">
                  {derived.analysis.themes.map((t) => <span key={t} className="orion-chip blue">{t}</span>)}
                </div>
              </div>
              <div>
                <div className="orion-muted" style={{ marginBottom: 6, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tensions</div>
                <div className="orion-cloud">
                  {derived.analysis.tensions.map((t) => <span key={t} className="orion-chip amber">{t}</span>)}
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {derived && hasCompletedStage("insight") && derived.insights.length > 0 && (
          <SectionCard key="insights" icon={<Lightbulb size={16} />} title="Insights" delay={0.05}>
            <div className="orion-insight-grid">
              {derived.insights.map((i, idx) => (
                <motion.div
                  className="orion-insight-card"
                  key={i.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h3>{i.title}</h3>
                    <ConfidenceBar value={i.confidence} />
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55 }}>{i.summary}</p>
                  <div className="impl">
                    {i.implications} <CitationChips ids={i.citations} />
                  </div>
                </motion.div>
              ))}
            </div>
          </SectionCard>
        )}

        {derived && hasCompletedStage("contradict") && derived.contradictions.length > 0 && (
          <SectionCard key="contradictions" icon={<Scale size={16} />} title="Contradictions" delay={0.1}>
            {derived.contradictions.map((c) => {
              const [a, b] = (c.sides ?? "").split(/\s+(?:vs\.?|versus|\|)\s+/i);
              return (
                <div key={c.claim} className="orion-contradiction">
                  <div className="claim">{c.claim}</div>
                  {b ? (
                    <div className="sides">
                      <div>{a}</div>
                      <div className="vs">VS</div>
                      <div>{b}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5 }}>{c.sides}</div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <CitationChips ids={c.citations} />
                  </div>
                </div>
              );
            })}
          </SectionCard>
        )}

        {derived && hasCompletedStage("gaps") && derived.gaps.length > 0 && (
          <SectionCard key="gaps" icon={<HelpCircle size={16} />} title="Open questions & gaps" delay={0.15}>
            {derived.gaps.map((g, i) => (
              <div key={g.question} className="orion-gap">
                <div className="num">{i + 1}</div>
                <div>
                  <div className="q">{g.question}</div>
                  <div className="why">{g.why_it_matters}</div>
                  <div className="next"><strong>Next step:</strong> {g.suggested_next_step}</div>
                </div>
              </div>
            ))}
          </SectionCard>
        )}

        {derived && hasCompletedStage("deepen") && (derived.gaps.length > 0 || derived.contradictions.length > 0) && (
          <SectionCard key="deepen" icon={<Sparkles size={16} />} title="Deepen" delay={0.18}>
            <div className="orion-meta-grid">
              <div className="orion-meta-card">
                <div className="label">Best next evidence move</div>
                <p>{derived.gaps[0]?.suggested_next_step ?? "Expand the source set with tighter primary evidence."}</p>
              </div>
              <div className="orion-meta-card">
                <div className="label">Where to press harder</div>
                <p>{derived.contradictions[0]?.claim ?? derived.analysis.tensions[0] ?? "Pressure-test the weakest-supported claims against stronger evidence."}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {derived && hasCompletedStage("guardrail") && (
          <SectionCard key="guardrails" icon={<Sparkles size={16} />} title="Guardrails" delay={0.19}>
            <div className="orion-meta-grid">
              <div className="orion-meta-card">
                <div className="label">Evidence boundary</div>
                <p>Claims should stay anchored to the curated sources and their cited confidence range.</p>
              </div>
              <div className="orion-meta-card">
                <div className="label">Weak-claim watchlist</div>
                <p>{derived.analysis.tensions[0] ?? "Watch for overstated certainty where the evidence base is still mixed."}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {reportHtml && (
          <SectionCard key="report" icon={<FileText size={16} />} title="Report" delay={0.2}>
            <div className="orion-report-frame" dangerouslySetInnerHTML={{ __html: reportHtml }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                className="orion-btn-primary"
                onClick={() => {
                  void handleReportDownload(reportHtml, session.topic);
                }}
                disabled={isDownloading}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} /> {isDownloading ? "Preparing PDF…" : "Download PDF"}
              </button>
            </div>
          </SectionCard>
        )}
      </AnimatePresence>
    </main>
  );
}