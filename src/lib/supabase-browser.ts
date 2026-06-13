import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const FALLBACK_SUPABASE_URL = "https://tobdkhzivbxtkezluyzd.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GTr5QaQD-j95yxqI6cNHHQ_XT2Y2lKt";

declare global {
  interface Window {
    __ORION_PUBLIC_ENV__?: {
      SUPABASE_URL?: string;
      SUPABASE_PUBLISHABLE_KEY?: string;
    };
  }
}

function getBrowserBackendConfig() {
  const injected = typeof window !== "undefined" ? window.__ORION_PUBLIC_ENV__ : undefined;

  const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL || injected?.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    injected?.SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
}

function createBrowserSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getBrowserBackendConfig();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Missing backend environment variable(s): ${missing.join(", ")}.`,
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createBrowserSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createBrowserSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createBrowserSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
