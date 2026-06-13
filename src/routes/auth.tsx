import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(
      "Auth isn't wired yet — connect Lovable Cloud to enable real sign-in. Continuing as guest.",
    );
    window.setTimeout(() => navigate({ to: "/" }), 1100);
  }

  return (
    <main>
      <section className="orion-card" style={{ maxWidth: 460, margin: "40px auto" }}>
        <h1 className="orion-grad">{mode === "login" ? "Sign in" : "Create account"}</h1>
        <p className="orion-muted">Access your ORION research workspace.</p>
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
          <button className="orion-btn-primary" type="submit">
            {mode === "login" ? "Sign in" : "Sign up"}
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