import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as unknown as {
  from: (table: string) => any;
};

interface SessionRow {
  id: string;
  topic: string;
  name: string | null;
  persona: string;
  status: string;
  source_count: number;
  insight_count: number;
  contradiction_count: number;
  created_at: string;
}

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Research History — ORION Insights" },
      { name: "description", content: "Your past research sessions and their stats." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("research_sessions")
      .select("id, topic, name, persona, status, source_count, insight_count, contradiction_count, created_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as SessionRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function rename(id: string) {
    await supabase.from("research_sessions").update({ name: draft || null }).eq("id", id);
    setEditing(null);
    setDraft("");
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this session?")) return;
    await supabase.from("research_sessions").delete().eq("id", id);
    load();
  }

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Research History</h1>
        <p className="orion-muted">All your past sessions. Open one to revisit the report.</p>
        {error && <p style={{ color: "#ff7a90" }}>{error}</p>}
        {rows === null && <p className="orion-muted">Loading…</p>}
        {rows && rows.length === 0 && (
          <p className="orion-muted">
            No sessions yet. <Link to="/">Start one</Link>.
          </p>
        )}
        {rows && rows.map((r) => (
          <div key={r.id} className="orion-src" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {editing === r.id ? (
                <>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={r.topic}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button className="orion-btn-primary" onClick={() => rename(r.id)}>Save</button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <Link to="/session/$sid" params={{ sid: r.id }} style={{ flex: 1, fontWeight: 600 }}>
                    {r.name || r.topic}
                  </Link>
                  <span className="orion-tag">{r.persona}</span>
                  <span className="orion-tag sel">{r.status}</span>
                </>
              )}
            </div>
            <div className="orion-muted" style={{ marginTop: 6, fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span>· {r.source_count} sources</span>
              <span>· {r.insight_count} insights</span>
              <span>· {r.contradiction_count} contradictions</span>
              {editing !== r.id && (
                <>
                  <button
                    onClick={() => { setEditing(r.id); setDraft(r.name ?? ""); }}
                    style={{ background: "none", border: "none", color: "var(--orion-cyan)", cursor: "pointer", padding: 0, font: "inherit" }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => del(r.id)}
                    style={{ background: "none", border: "none", color: "#ff7a90", cursor: "pointer", padding: 0, font: "inherit" }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}