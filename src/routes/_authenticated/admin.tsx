import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAllUsers, setAdminRole, checkIsAdmin, type AdminUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "ORION — Admin" },
      { name: "description", content: "Admin view of all registered ORION users." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const check = useServerFn(checkIsAdmin);
  const list = useServerFn(listAllUsers);
  const setRole = useServerFn(setAdminRole);
  const qc = useQueryClient();

  const access = useQuery({ queryKey: ["admin", "access"], queryFn: () => check() });
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
    enabled: !!access.data?.isAdmin,
  });
  const mutate = useMutation({
    mutationFn: (v: { userId: string; makeAdmin: boolean }) => setRole({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  if (access.isLoading) {
    return (
      <main>
        <section className="orion-card"><p className="orion-muted">Checking access…</p></section>
      </main>
    );
  }

  if (!access.data?.isAdmin) {
    return (
      <main>
        <section className="orion-card">
          <h1 className="orion-grad">Admin</h1>
          <p className="orion-muted">You don't have permission to view this page.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Admin — Users</h1>
        <p className="orion-muted">
          {users.data ? `${users.data.length} registered users` : "Loading users…"}
        </p>

        {users.error && (
          <p style={{ color: "#ff7a90" }}>
            {users.error instanceof Error ? users.error.message : String(users.error)}
          </p>
        )}

        {users.data && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--orion-muted)" }}>
                  <Th>User</Th>
                  <Th>Email</Th>
                  <Th>Joined</Th>
                  <Th>Last sign-in</Th>
                  <Th>Persona</Th>
                  <Th>Theme</Th>
                  <Th>Sessions</Th>
                  <Th>Role</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u: AdminUser) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--orion-border)" }}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: "50%" }}
                          />
                        ) : null}
                        <span>{u.display_name ?? "—"}</span>
                      </div>
                    </Td>
                    <Td>{u.email ?? "—"}</Td>
                    <Td>{fmt(u.created_at)}</Td>
                    <Td>{u.last_sign_in_at ? fmt(u.last_sign_in_at) : "—"}</Td>
                    <Td>{u.default_persona ?? "—"}</Td>
                    <Td>{u.theme ?? "—"}</Td>
                    <Td>{u.session_count}</Td>
                    <Td>
                      <span className={u.is_admin ? "orion-tag sel" : "orion-tag"}>
                        {u.is_admin ? "admin" : "user"}
                      </span>
                    </Td>
                    <Td>
                      <button
                        disabled={mutate.isPending}
                        onClick={() =>
                          mutate.mutate({ userId: u.id, makeAdmin: !u.is_admin })
                        }
                        style={{
                          background: "none",
                          border: "1px solid var(--orion-border)",
                          color: "var(--orion-cyan)",
                          padding: "4px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {u.is_admin ? "Revoke admin" : "Make admin"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "8px 10px", fontWeight: 500 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>{children}</td>;
}
function fmt(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}