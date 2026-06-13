import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Theme = "system" | "light" | "dark";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_persona: string;
  default_threshold: number;
  theme: Theme;
  agent_models: Record<string, string>;
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", u.user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", u.user.id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let alive = true;
    fetchProfile().then((p) => alive && setProfile(p));
    return () => {
      alive = false;
    };
  }, []);
  return profile;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.dataset.theme = resolved;
}