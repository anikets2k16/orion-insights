import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const ROLES = ["retrieval", "analysis", "insight", "report"];

export default function Settings() {
  const [models, setModels] = useState([]);

  useEffect(() => {
    api.models().then((r) => setModels(r.models)).catch(() => {});
  }, []);

  return (
    <div className="card">
      <h1 className="grad">Agent Configuration</h1>
      <p className="muted">Swap the model per agent role. Only dated snapshot ids are allowed
        (determinism, NFR-1).</p>
      {ROLES.map((role) => (
        <div key={role}>
          <label>{role}</label>
          <select>
            {models
              .filter((m) => m.recommended_for?.includes(role) || true)
              .map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} · {m.tier}{m.recommended_for?.includes(role) ? " ★" : ""}
                </option>
              ))}
          </select>
        </div>
      ))}
      <button className="primary">Save configuration</button>
    </div>
  );
}
