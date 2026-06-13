import { useState } from "react";
import { api, setToken } from "../lib/api.js";

export default function Login({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const fn = mode === "login" ? api.login : api.signup;
      const res = await fn(email, password);
      setToken(res.access_token);
      onAuth(res.user_id);
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "60px auto" }}>
      <h1 className="grad">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <p className="muted">Access your ORION research workspace.</p>
      <form onSubmit={submit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="primary" type="submit">{mode === "login" ? "Sign in" : "Sign up"}</button>
      </form>
      {error && <div className="error">{error}</div>}
      <p className="muted" style={{ marginTop: 14 }}>
        {mode === "login" ? "No account?" : "Have an account?"}{" "}
        <a href="#" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Sign up" : "Sign in"}
        </a>
      </p>
    </div>
  );
}
