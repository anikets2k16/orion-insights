import { Link } from "@tanstack/react-router";

export function Nav() {
  return (
    <header>
      <Link to="/" className="orion-brand orion-grad" style={{ textDecoration: "none" }}>
        ORION
      </Link>
      <nav className="orion-nav" aria-label="Primary">
        <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "active" }}>
          New Research
        </Link>
        <Link to="/agents" activeProps={{ className: "active" }}>
          Agents
        </Link>
        <Link to="/auth" activeProps={{ className: "active" }} style={{ marginLeft: "auto" }}>
          Sign in
        </Link>
      </nav>
    </header>
  );
}