import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ORION Insights" },
      {
        name: "description",
        content: "Access your ORION research workspace.",
      },
      { property: "og:title", content: "Sign in — ORION Insights" },
      { property: "og:description", content: "Access your ORION research workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setInfo("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      setInfo(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setInfo(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setInfo(result.error.message ?? "Google sign-in failed.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  return (
    <main>
      <section className="orion-card" style={{ maxWidth: 460, margin: "40px auto" }}>
        <h1 className="orion-grad">{mode === "login" ? "Sign in" : "Create account"}</h1>
        <p className="orion-muted">Access your ORION research workspace.</p>
        <button
          type="button"
          className="orion-btn-primary"
          onClick={google}
          disabled={busy}
          style={{ width: "100%" }}
        >
          Continue with Google
        </button>
        <div className="orion-muted" style={{ textAlign: "center", margin: "14px 0" }}>
          — or —
        </div>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="orion-btn-primary" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>
        {info && <p className="orion-muted" style={{ marginTop: 12 }}>{info}</p>}
        <p className="orion-muted" style={{ marginTop: 16 }}>
          {mode === "login" ? "No account?" : "Have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            style={{
              background: "none",
              border: "none",
              color: "var(--orion-cyan)",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}