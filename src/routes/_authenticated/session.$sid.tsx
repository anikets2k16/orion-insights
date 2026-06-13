import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase as _supabase } from "@/lib/supabase-browser";
import { orionApi, type BackendSource } from "@/lib/orion-api";
import { getSession, PERSONA_LABELS, updateSession, type SessionState } from "@/lib/research";

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

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function SessionPage() {
  const { sid } = Route.useParams();
  const [session, setSession] = useState<SessionState | null>(() => getSession(sid));
  const [sources, setSources] = useState<BackendSource[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ status: string; progress: number; current_phase: string; report_url?: string | null } | null>(null);
  const pollRef = useRef<number | null>(null);

  const apiConfigured = orionApi.configured();

  // Poll backend /status until complete.
  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    async function tick() {
      try {
        const s = await orionApi.status(sid);
        if (cancelled) return;
        setStatus(s);
        if (session) {
          const next = updateSession(sid, { phase: s.current_phase, progress: s.progress });
          if (next) setSession(next);
        }
        if (s.status !== "complete" && s.status !== "failed") {
          pollRef.current = window.setTimeout(tick, 1500);
        }
      } catch (e) {
        if (!cancelled) setError(messageOf(e));
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [sid, apiConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch sources once the backend has them (whenever status changes past 'queued').
  useEffect(() => {
    if (!apiConfigured || sources) return;
    if (!status || status.status === "queued") return;
    (async () => {
      try {
        const r = await orionApi.sources(sid);
        if (r.sources && r.sources.length > 0) setSources(r.sources);
      } catch {
        /* sources may not be ready yet — keep polling */
      }
    })();
  }, [status?.status, sources, sid, apiConfigured]);

  // Once complete, fetch the report HTML and mirror to Supabase.
  useEffect(() => {
    if (!apiConfigured || reportHtml) return;
    if (!status || status.status !== "complete") return;
    (async () => {
      try {
        const html = await orionApi.reportHtml(sid);
        setReportHtml(html);
        await supabase
          .from("research_sessions")
          .update({ status: "complete", report_html: html })
          .eq("id", sid);
      } catch (e) {
        setError(messageOf(e));
      }
    })();
  }, [status?.status, reportHtml, sid, apiConfigured]);

  // If we landed here without local state (e.g. opened from History), try to load the saved report from Supabase.
  useEffect(() => {
    if (session || reportHtml) return;
    (async () => {
      const { data } = await supabase
        .from("research_sessions")
        .select("report_html")
        .eq("id", sid)
        .maybeSingle();
      if (data?.report_html) setReportHtml(data.report_html);
    })();
  }, [session, sid, reportHtml]);

  async function submitCuration() {
    if (!sources) return;
    const urls = Object.keys(selected).filter((u) => selected[u]);
    if (urls.length === 0) {
      setError("Pick at least one source to continue.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await orionApi.curate(sid, urls);
      const next = updateSession(sid, { curated: urls });
      if (next) setSession(next);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const progress = useMemo(() => {
    if (status?.status === "complete") return 1;
    return status?.progress ?? 0;
  }, [status]);

  if (!apiConfigured) {
    return (
      <main>
        <div className="orion-card">
          <h1 className="orion-grad">Backend not configured</h1>
          <p className="orion-muted">
            The ORION Python backend URL is not set. Deploy the FastAPI service
            (see <code>render.yaml</code> in this repo) and set{" "}
            <code>VITE_ORION_API_URL</code> in your Lovable environment.
          </p>
          <Link to="/" className="orion-btn-primary" style={{ display: "inline-block", marginTop: 12 }}>
            Back home
          </Link>
        </div>
      </main>
    );
  }

  if (!session && reportHtml) {
    return (
      <main>
        <section className="orion-card">
          <h1 className="orion-grad">Saved Report</h1>
          <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
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

  const currentPhase = status?.current_phase ?? session.phase;

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

        <p style={{ marginTop: 10 }} className="orion-muted">
          Status: <strong>{status?.status ?? "queued"}</strong> · phase{" "}
          <span className="orion-tag sel">{currentPhase}</span>
        </p>

        {error && <p style={{ marginTop: 14, color: "#ff7a90" }}>{error}</p>}
      </section>

      {sources && !session.curated && (
        <section className="orion-card">
          <h2>
            Source curation <span className="orion-muted">— your decision</span>
          </h2>
          {sources.map((s) => (
            <div className="orion-src" key={s.url}>
              <span className="score">{(s.confidence ?? 0).toFixed(2)}</span>
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
                {s.source_type && <span className="orion-tag">{s.source_type}</span>}
                {s.rationale && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 13 }}>{s.rationale}</div>
                )}
                {s.snippet && (
                  <div className="orion-muted" style={{ marginTop: 4, fontSize: 12, fontStyle: "italic" }}>
                    "{s.snippet.slice(0, 220)}…"
                  </div>
                )}
              </label>
            </div>
          ))}
          <button className="orion-btn-primary" onClick={submitCuration} disabled={busy}>
            {busy ? "Submitting…" : "Use selected sources & continue"}
          </button>
        </section>
      )}

      {session.curated && !reportHtml && status?.status !== "complete" && (
        <section className="orion-card">
          <h2>Pipeline running</h2>
          <p className="orion-muted">
            {session.curated.length} sources selected. The backend is now running analysis,
            contradiction, insight, guardrail, and report phases. The report appears here as soon
            as the backend marks the session complete.
          </p>
        </section>
      )}

      {reportHtml && (
        <section className="orion-card">
          <h2>Report</h2>
          <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
        </section>
      )}
    </main>
  );
}