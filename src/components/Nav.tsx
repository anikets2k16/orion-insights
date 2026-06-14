import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { checkIsAdmin } from "@/lib/admin.functions";
import orionIcon from "@/assets/orion-icon.png";

export function Nav() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const check = useServerFn(checkIsAdmin);
  const adminQ = useQuery({
    queryKey: ["admin", "access", email],
    queryFn: () => check(),
    enabled: !!email,
    staleTime: 60_000,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header>
      <Link
        to="/"
        className="orion-brand orion-grad"
        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}
      >
        <img
          src={orionIcon}
          alt="Orion"
          width={40}
          height={40}
          style={{
            display: "block",
            filter: "drop-shadow(0 0 8px rgba(0,212,255,0.55)) drop-shadow(0 0 18px rgba(139,92,246,0.35))",
          }}
        />
        <span>ORION</span>
      </Link>
      <nav className="orion-nav" aria-label="Primary">
        {email ? (
          <>
            <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "active" }}>
              New
            </Link>
            <Link to="/history" activeProps={{ className: "active" }}>
              History
            </Link>
            <Link to="/agents" activeProps={{ className: "active" }}>
              Agents
            </Link>
            <Link to="/profile" activeProps={{ className: "active" }}>
              Profile
            </Link>
            {adminQ.data?.isAdmin && (
              <Link to="/admin" activeProps={{ className: "active" }}>
                Admin
              </Link>
            )}
            <button
              onClick={signOut}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "var(--orion-cyan)",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth" activeProps={{ className: "active" }} style={{ marginLeft: "auto" }}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}