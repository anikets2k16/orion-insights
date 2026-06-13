import { useState } from "react";
import { api } from "../lib/api.js";

const PERSONAS = [
  { id: "researcher", label: "Researcher" },
  { id: "product_manager", label: "Product Manager" },
  { id: "content_creator", label: "Content Creator" },
];

export default function NewResearch({ onStarted }) {
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState("researcher");
  const [threshold, setThreshold] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await api.startResearch({
        topic,
        persona,
        confidence_threshold: Number(threshold),
        max_sources: 10,
      });
      onStarted(res.session_id);
    } catch (err) {
      setError(String(err.message || err));
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h1 className="grad">New Research</h1>
      <label>Topic</label>
      <textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. AI trends in healthcare 2026" />
      <label>Persona</label>
      <select value={persona} onChange={(e) => setPersona(e.target.value)}>
        {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <label>Confidence threshold ({threshold})</label>
      <input type="range" min="0" max="1" step="0.05" value={threshold}
        onChange={(e) => setThreshold(e.target.value)} />
      <button className="primary" disabled={!topic || busy} onClick={start}>
        {busy ? "Starting…" : "Start research"}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
