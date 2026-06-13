import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const PIPELINE = ["intake", "clarify", "retrieve", "score", "analyse", "insight", "guardrail", "report"];

export default function Session({ sid }) {
  const [status, setStatus] = useState(null);
  const [sources, setSources] = useState([]);
  const [selected, setSelected] = useState({});

  // Poll status. (Re-running an existing session is deterministic — same result hash.)
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.status(sid);
        if (!alive) return;
        setStatus(s);
        if (s.progress >= 0.45 && sources.length === 0) {
          const { sources: src } = await api.sources(sid);
          setSources(src);
        }
      } catch (_) {}
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [sid, sources.length]);

  const phaseIdx = status ? PIPELINE.indexOf(status.current_phase) : 0;

  async function curate() {
    const urls = Object.keys(selected).filter((u) => selected[u]);
    await api.curate(sid, urls);
  }

  return (
    <div>
      <div className="card">
        <h1 className="grad">Research Session</h1>
        <p className="muted">{sid}</p>
        <div className="progress"><div style={{ width: `${(status?.progress || 0) * 100}%` }} /></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PIPELINE.map((p, i) => (
            <span key={p} className={"tag" + (i <= phaseIdx ? " sel" : "")}>{p}</span>
          ))}
        </div>
        {status?.report_url && (
          <p style={{ marginTop: 14 }}>
            <a href={`/api/reports/${sid}/view`} target="_blank" rel="noreferrer">Open report →</a>{" · "}
            <a href={`/api/reports/${sid}/validation`} target="_blank" rel="noreferrer">Validation report →</a>
          </p>
        )}
      </div>

      {sources.length > 0 && (
        <div className="card">
          <h2>Source curation <span className="muted">— your decision</span></h2>
          {sources.map((s) => (
            <div className="src" key={s.url}>
              <span className="score">{s.confidence}</span>
              <label style={{ flex: 1, margin: 0, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" style={{ width: "auto", marginRight: 8 }}
                  checked={!!selected[s.url]}
                  onChange={(e) => setSelected({ ...selected, [s.url]: e.target.checked })} />
                <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                <span className="tag">{s.source_type}</span>
              </label>
            </div>
          ))}
          <button className="primary" onClick={curate}>Use selected sources</button>
        </div>
      )}
    </div>
  );
}
