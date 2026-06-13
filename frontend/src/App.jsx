import { useState } from "react";
import ParticleField from "./components/ParticleField.jsx";
import Login from "./pages/Login.jsx";
import NewResearch from "./pages/NewResearch.jsx";
import Session from "./pages/Session.jsx";
import Settings from "./pages/Settings.jsx";
import { getToken, clearToken } from "./lib/api.js";

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [view, setView] = useState("new"); // new | session | settings
  const [sid, setSid] = useState(null);

  if (!authed) {
    return (
      <>
        <ParticleField />
        <div className="shell"><Login onAuth={() => setAuthed(true)} /></div>
      </>
    );
  }

  return (
    <>
      <ParticleField />
      <div className="shell">
        <div className="brand grad">ORION</div>
        <div className="nav">
          <button className={view === "new" ? "active" : ""} onClick={() => setView("new")}>New Research</button>
          <button className={view === "session" ? "active" : ""} onClick={() => setView("session")} disabled={!sid}>
            Session
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Agents</button>
          <button onClick={() => { clearToken(); setAuthed(false); }} style={{ marginLeft: "auto" }}>Sign out</button>
        </div>

        {view === "new" && (
          <NewResearch onStarted={(id) => { setSid(id); setView("session"); }} />
        )}
        {view === "session" && sid && <Session sid={sid} />}
        {view === "settings" && <Settings />}
      </div>
    </>
  );
}
