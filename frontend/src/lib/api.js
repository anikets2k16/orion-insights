// Thin API client (FR-24). Token kept in localStorage.
// API base: in production (Lovable/static host) set VITE_API_URL to the deployed backend,
// e.g. https://orion-api.onrender.com. Locally it falls back to the Vite dev proxy ("/api").
const TOKEN_KEY = "orion_token";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const api = {
  signup: (email, password) => req("/auth/signup", { method: "POST", body: { email, password } }),
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password } }),
  models: () => req("/agents/models"),
  startResearch: (payload) => req("/research/start", { method: "POST", body: payload }),
  status: (sid) => req(`/research/${sid}/status`),
  sources: (sid) => req(`/research/${sid}/sources`),
  curate: (sid, urls) => req(`/research/${sid}/curate`, { method: "POST", body: { selected_urls: urls } }),
  artifacts: (sid, arts) => req(`/research/${sid}/artifacts`, { method: "POST", body: { artifacts: arts } }),
  report: (sid) => req(`/research/${sid}/report`),
  validation: (sid) => req(`/reports/${sid}/validation`),
};
