import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { checkIsAdmin } from "@/lib/admin.functions";

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
      <Link to="/" className="orion-brand orion-grad" style={{ textDecoration: "none" }}>
        ORION
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
            {(adminQ.data?.isAdmin || adminQ.data?.bootstrapAvailable) && (
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