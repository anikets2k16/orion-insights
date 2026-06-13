/**
 * ORION Python backend client.
 *
 * Mirrors the FastAPI contract in api/routes/ (research, agents, reports).
 * The backend lives in a separate service (deploy via render.yaml in the repo root)
 * and is reached over HTTPS. The browser attaches the Supabase JWT as a bearer so
 * the backend can identify the user.
 *
 * Set the backend URL via VITE_ORION_API_URL (e.g. https://orion-api-xxx.onrender.com).
 * When unset, every call rejects with a clear "not configured" error.
 */
import { supabase } from "@/lib/supabase-browser";

const BASE = (import.meta.env.VITE_ORION_API_URL as string | undefined)?.replace(/\/$/, "");

export class OrionApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "OrionApiError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE) {
    throw new OrionApiError(
      "ORION backend not configured. Set VITE_ORION_API_URL to your deployed FastAPI URL (see render.yaml).",
    );
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OrionApiError(
      `ORION ${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// ---------- types mirroring api/routes/research.py ----------

export type Persona = "researcher" | "product_manager" | "content_creator";

export interface StartRequest {
  topic: string;
  persona: Persona;
  context_urls?: string[];
  confidence_threshold?: number;
  max_sources?: number;
  selected_agent_models?: Record<string, string>;
  integration_targets?: string[];
}

export interface StartResponse {
  session_id: string;
  status: string;
  progress?: number;
  current_phase?: string;
  report_url?: string | null;
}

export interface StatusResponse {
  session_id: string;
  status: string;
  progress: number;
  current_phase: string;
  report_url?: string | null;
}

export interface BackendSource {
  url: string;
  title: string;
  source_type?: string;
  confidence: number;
  rationale?: string;
  snippet?: string;
  citation?: number;
}

export interface HealthResponse {
  status: string;
  version?: string;
  env?: string;
  deterministic?: boolean;
  llm_cache_mode?: string;
}

export const orionApi = {
  configured: () => Boolean(BASE),
  baseUrl: () => BASE ?? "",
  reportViewUrl: (sid: string) => (BASE ? `${BASE}/api/reports/${sid}/view` : ""),

  health: () => call<HealthResponse>("/api/health"),

  startResearch: (body: StartRequest) =>
    call<StartResponse>("/api/research/start", { method: "POST", body: JSON.stringify(body) }),

  status: (sid: string) => call<StatusResponse>(`/api/research/${sid}/status`),

  sources: (sid: string) => call<{ sources: BackendSource[] }>(`/api/research/${sid}/sources`),

  curate: (sid: string, selected_urls: string[]) =>
    call<{ selected: number }>(`/api/research/${sid}/curate`, {
      method: "POST",
      body: JSON.stringify({ selected_urls }),
    }),

  artifacts: (sid: string, artifacts: string[]) =>
    call<unknown>(`/api/research/${sid}/artifacts`, {
      method: "POST",
      body: JSON.stringify({ artifacts }),
    }),

  // Returns full HTML — render via dangerouslySetInnerHTML or iframe srcdoc.
  reportHtml: (sid: string) => call<string>(`/api/reports/${sid}/view`),

  models: () => call<{ models: unknown[] }>("/api/agents/models"),
};