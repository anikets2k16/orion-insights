import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchProfile, updateProfile, applyTheme, type Profile, type Theme } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ORION Insights" },
      { name: "description", content: "Customize your ORION profile, defaults, and theme." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile().then(setP);
  }, []);

  if (!p) return <main><div className="orion-card"><p className="orion-muted">Loading…</p></div></main>;

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  }

  async function save() {
    setError(null);
    try {
      const updated = await updateProfile({
        display_name: p!.display_name,
        avatar_url: p!.avatar_url,
        default_persona: p!.default_persona,
        default_threshold: p!.default_threshold,
        theme: p!.theme,
      });
      if (updated) {
        setP(updated);
        applyTheme(updated.theme);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Your Profile</h1>
        <p className="orion-muted">Identity and defaults applied to every new research run.</p>

        <label htmlFor="dn">Display name</label>
        <input
          id="dn"
          value={p.display_name ?? ""}
          onChange={(e) => set("display_name", e.target.value)}
        />

        <label htmlFor="av">Avatar URL</label>
        <input
          id="av"
          value={p.avatar_url ?? ""}
          onChange={(e) => set("avatar_url", e.target.value)}
          placeholder="https://…"
        />
        {p.avatar_url && (
          <img
            src={p.avatar_url}
            alt="avatar"
            style={{ width: 64, height: 64, borderRadius: "50%", marginTop: 8 }}
          />
        )}

        <label htmlFor="dp">Default persona</label>
        <select
          id="dp"
          value={p.default_persona}
          onChange={(e) => set("default_persona", e.target.value)}
        >
          <option value="researcher">Researcher</option>
          <option value="product_manager">Product Manager</option>
          <option value="content_creator">Content Creator</option>
        </select>

        <label htmlFor="th">
          Default confidence threshold ({p.default_threshold.toFixed(2)})
        </label>
        <input
          id="th"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={p.default_threshold}
          onChange={(e) => set("default_threshold", Number(e.target.value))}
        />

        <label htmlFor="theme">Theme</label>
        <select
          id="theme"
          value={p.theme}
          onChange={(e) => set("theme", e.target.value as Theme)}
        >
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>

        <button className="orion-btn-primary" onClick={save}>Save profile</button>
        {saved && <p className="orion-muted" style={{ marginTop: 10 }}>Saved.</p>}
        {error && <p style={{ color: "#ff7a90", marginTop: 10 }}>{error}</p>}
      </section>
    </main>
  );
}