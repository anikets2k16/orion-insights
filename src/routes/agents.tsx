import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AGENT_ROLES, AVAILABLE_MODELS, type AgentRole } from "../lib/models";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agent Configuration — ORION Insights" },
      {
        name: "description",
        content:
          "Swap the LLM behind each agent role. Only dated snapshot model ids are allowed for determinism.",
      },
      { property: "og:title", content: "Agent Configuration — ORION Insights" },
      {
        property: "og:description",
        content: "Per-role model selection with snapshot-only enforcement.",
      },
    ],
  }),
  component: AgentsPage,
});

function defaultFor(role: AgentRole): string {
  return (
    AVAILABLE_MODELS.find((m) => m.recommended_for.includes(role))?.name ??
    AVAILABLE_MODELS[0].name
  );
}

function AgentsPage() {
  const [config, setConfig] = useState<Record<AgentRole, string>>(() =>
    Object.fromEntries(AGENT_ROLES.map((r) => [r, defaultFor(r)])) as Record<AgentRole, string>,
  );
  const [saved, setSaved] = useState(false);

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Agent Configuration</h1>
        <p className="orion-muted">
          Choose the model behind each agent role. Only dated snapshot ids are allowed —
          floating aliases break determinism (NFR-1).
        </p>

        {AGENT_ROLES.map((role) => (
          <div key={role}>
            <label htmlFor={`role-${role}`}>{role}</label>
            <select
              id={`role-${role}`}
              value={config[role]}
              onChange={(e) => {
                setConfig({ ...config, [role]: e.target.value });
                setSaved(false);
              }}
            >
              {AVAILABLE_MODELS.map((m) => {
                const recommended = m.recommended_for.includes(role);
                return (
                  <option key={m.name} value={m.name}>
                    {m.name} · {m.tier}
                    {recommended ? " ★" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        ))}

        <button
          className="orion-btn-primary"
          onClick={() => {
            window.localStorage.setItem("orion.agent_config", JSON.stringify(config));
            setSaved(true);
          }}
        >
          Save configuration
        </button>
        {saved && (
          <p className="orion-muted" style={{ marginTop: 10 }}>
            Saved locally. Will apply when a backend is connected.
          </p>
        )}
      </section>

      <section className="orion-card">
        <h2>Snapshot policy</h2>
        <p className="orion-muted">
          Every model id must end in a date (e.g. <code>gpt-4o-2024-08-06</code> or{" "}
          <code>claude-3-5-sonnet-20241022</code>). The deterministic router rejects floating
          aliases like <code>gpt-4o</code> at runtime.
        </p>
      </section>
    </main>
  );
}