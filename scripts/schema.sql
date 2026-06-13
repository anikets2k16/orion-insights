-- ORION schema (specs/data-model.md). RLS + append-only audit log (NFR-5).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  default_persona TEXT DEFAULT 'researcher',
  tier            TEXT DEFAULT 'free',
  agent_config    JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  topic      TEXT NOT NULL,
  persona    TEXT NOT NULL,
  status     TEXT DEFAULT 'intake',
  progress   REAL DEFAULT 0,
  state      JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Append-only: revoke UPDATE/DELETE and block via trigger.
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  session_id   UUID REFERENCES sessions(id),
  ts           TIMESTAMPTZ DEFAULT now(),
  content_hash TEXT NOT NULL,
  entry        JSONB NOT NULL
);

CREATE OR REPLACE FUNCTION block_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION block_mutation();

CREATE TABLE IF NOT EXISTS integration_configs (
  user_id   UUID REFERENCES users(id),
  provider  TEXT NOT NULL,
  config    JSONB NOT NULL,
  encrypted BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, provider)
);

-- Row-level security (per-user isolation).
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_owner ON sessions USING (user_id = auth.uid());
CREATE POLICY integ_owner ON integration_configs USING (user_id = auth.uid());
