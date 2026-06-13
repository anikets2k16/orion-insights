import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { startResearch, type Persona } from "../../lib/research";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "ORION Insights — Start a Research Session" },
      {
        name: "description",
        content:
          "Kick off a deterministic multi-agent research run. Pick a persona, set a confidence threshold, and watch the pipeline work.",
      },
      { property: "og:title", content: "ORION Insights — Start a Research Session" },
      {
        property: "og:description",
        content:
          "Kick off a deterministic multi-agent research run with full source curation.",
      },
    ],
  }),
  component: NewResearch,
});

const PERSONAS: { id: Persona; label: string; blurb: string }[] = [
  { id: "researcher", label: "Researcher", blurb: "Methodological rigour and evidence chains" },
  { id: "product_manager", label: "Product Manager", blurb: "Opportunities, risks, and bets" },
  { id: "content_creator", label: "Content Creator", blurb: "Hooks, narratives, and shareability" },
];

function NewResearch() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState<Persona>("researcher");
  const [threshold, setThreshold] = useState(0.7);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setBusy(true);
    const state = startResearch({ topic: topic.trim(), persona, threshold });
    navigate({ to: "/session/$sid", params: { sid: state.sid } });
  }

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">New Research</h1>
        <p className="orion-muted">
          ORION orchestrates clarification, retrieval, scoring, analysis, insight, and guardrail
          agents to produce a curated report with full source transparency.
        </p>

        <form onSubmit={submit}>
          <label htmlFor="topic">Topic</label>
          <textarea
            id="topic"
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. AI trends in healthcare 2026"
            required
          />

          <label htmlFor="persona">Persona</label>
          <select
            id="persona"
            value={persona}
            onChange={(e) => setPersona(e.target.value as Persona)}
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.blurb}
              </option>
            ))}
          </select>

          <label htmlFor="threshold">
            Confidence threshold ({threshold.toFixed(2)})
          </label>
          <input
            id="threshold"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />

          <button className="orion-btn-primary" disabled={!topic.trim() || busy} type="submit">
            {busy ? "Starting…" : "Start research"}
          </button>
        </form>
      </section>

      <section className="orion-card">
        <h2>What you'll get</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <Bullet>
            A curated source list scored by confidence — you decide what makes it into the report.
          </Bullet>
          <Bullet>
            Persona-tuned analysis: research rigour, PM framing, or content hooks.
          </Bullet>
          <Bullet>
            Deterministic by construction — re-running the same topic yields the same result hash.
          </Bullet>
        </div>
      </section>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span className="orion-tag sel" style={{ marginTop: 2 }}>✓</span>
      <span className="orion-muted" style={{ flex: 1, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
