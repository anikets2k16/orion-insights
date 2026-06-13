import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PIPELINE,
  curate,
  getSession,
  getSources,
  getStatus,
  PERSONA_LABELS,
  type SessionStatus,
  type Source,
} from "../lib/research";

export const Route = createFileRoute("/session/$sid")({
  head: ({ params }) => ({
    meta: [
      { title: `Session ${params.sid} — ORION Insights` },
      { name: "description", content: "Live research pipeline view and source curation." },
      { property: "og:title", content: "ORION Research Session" },
      { property: "og:description", content: "Watch the agents work and curate the sources." },
    ],
  }),
  loader: ({ params }) => {
    const s = getSession(params.sid);
    if (!s) throw notFound();
    return { sid: params.sid };
  },
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
  const session = useMemo(() => getSession(sid), [sid]);
  const [status, setStatus] = useState<SessionStatus | null>(() => getStatus(sid));
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [curated, setCurated] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const s = getStatus(sid);
      setStatus(s);
      if (s && s.progress >= 0.4 && sources.length === 0) {
        setSources(getSources(sid));
      }
    };
    tick();
    const id = window.setInterval(tick, 800);
    return () => window.clearInterval(id);
  }, [sid, sources.length]);

  const phaseIdx = status ? PIPELINE.indexOf(status.current_phase) : 0;

  function submitCuration() {
    const urls = Object.keys(selected).filter((u) => selected[u]);
    setCurated(curate(sid, urls));
  }

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Research Session</h1>
        <p className="orion-muted" style={{ wordBreak: "break-all" }}>
          {sid}
          {session && (
            <>
              {" · "}
              <span style={{ color: "var(--orion-blue)" }}>{PERSONA_LABELS[session.persona]}</span>
              {" · threshold "}
              {session.threshold.toFixed(2)}
            </>
          )}
        </p>
        {session && (
          <p style={{ marginTop: 8 }}>
            <strong>Topic:</strong> {session.topic}
          </p>
        )}

        <div className="orion-progress" aria-label="Pipeline progress">
          <div style={{ width: `${(status?.progress ?? 0) * 100}%` }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PIPELINE.map((p, i) => (
            <span key={p} className={"orion-tag" + (i <= phaseIdx ? " sel" : "")}>
              {p}
            </span>
          ))}
        </div>

        {status?.status === "complete" && (
          <p style={{ marginTop: 14 }} className="orion-muted">
            Pipeline complete. Report and validation artifacts would render here when wired to a
            live backend.
          </p>
        )}
      </section>

      {sources.length > 0 && (
        <section className="orion-card">
          <h2>
            Source curation <span className="orion-muted">— your decision</span>
          </h2>
          {sources.map((s) => (
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
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>{" "}
                <span className="orion-tag">{s.source_type}</span>
              </label>
            </div>
          ))}
          <button className="orion-btn-primary" onClick={submitCuration}>
            Use selected sources
          </button>
          {curated !== null && (
            <p className="orion-muted" style={{ marginTop: 10 }}>
              {curated} source{curated === 1 ? "" : "s"} locked in.
            </p>
          )}
        </section>
      )}
    </main>
  );
}