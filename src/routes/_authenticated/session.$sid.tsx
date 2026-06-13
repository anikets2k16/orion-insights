import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase as _supabase } from "@/lib/supabase-browser";
import {
  continueAfterCuration,
  getSession,
  PERSONA_LABELS,
  PIPELINE,
  resumeInFlight,
  type SessionState,
} from "@/lib/research";

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
  const mirroredRef = useRef(false);

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
  const phaseIdx = session ? PIPELINE.indexOf(session.phase) : -1;

  if (!session && savedHtml) {
    return (
      <main>
        <section className="orion-card">
          <h1 className="orion-grad">Saved Report</h1>
          <div dangerouslySetInnerHTML={{ __html: savedHtml }} />
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
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {PIPELINE.map((p, i) => (
            <span key={p} className={"orion-tag" + (i <= phaseIdx ? " sel" : "")}>{p}</span>
          ))}
        </div>

        <p style={{ marginTop: 10 }} className="orion-muted">
          Status: <strong>{session.status ?? "running"}</strong>
        </p>

        {error && <p style={{ marginTop: 14, color: "#ff7a90" }}>{error}</p>}
      </section>

      {showCuration && (
        <section className="orion-card">
          <h2>
            Source curation <span className="orion-muted">— your decision</span>
          </h2>
          {session.sources!.map((s) => (
            <div className="orion-src" key={s.url}>
              <span className="score">{s.confidence.toFixed(2)}</span>
              <label style={{ flex: 1, margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", marginRight: 8, verticalAlign: "middle" }}
                  checked={!!selected[s.url]}
                  onChange={(e) => setSelected({ ...selected, [s.url]: e.target.checked })}
                />
                {s.citation != null && (
                  <span className="orion-muted" style={{ marginRight: 6 }}>[{s.citation}]</span>
                )}
                <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>{" "}
                <span className="orion-tag">{s.source_type}</span>
                {s.rationale && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 13 }}>{s.rationale}</div>
                )}
                {s.snippet && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 12, fontStyle: "italic" }}>
                    "{s.snippet}"
                  </div>
                )}
              </label>
            </div>
          ))}
          <button className="orion-btn-primary" onClick={submitCuration}>
            Use selected sources &amp; continue
          </button>
        </section>
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

      {session.reportHtml && (
        <section className="orion-card">
          <h2>Report</h2>
          <div dangerouslySetInnerHTML={{ __html: session.reportHtml }} />
        </section>
      )}
    </main>
  );
}