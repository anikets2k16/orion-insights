#!/usr/bin/env python3
"""ORION Deployment Console — single-click local deploy UI.

Pure Python stdlib (no pip needed) so it runs on a fresh machine and can bootstrap
everything else. Serves a styled page; buttons stream real command output over SSE.

Run:  python3 deploy/console.py     (opens http://127.0.0.1:8900)

Security: binds to 127.0.0.1 only and runs a *fixed* allowlist of commands (no arbitrary
input is executed). Intended as a local developer tool.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent          # orion-researcher/
HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs"
LOGS.mkdir(exist_ok=True)
HOST, PORT = "127.0.0.1", 8900

# Required + optional .env keys surfaced in the editor.
ENV_KEYS = [
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TAVILY_API_KEY", "SERPAPI_KEY",
    "JWT_SECRET", "DATABASE_URL", "REDIS_URL",
    "ORION_TASK_BACKEND", "ORION_SESSION_BACKEND", "ORION_LLM_CACHE_MODE",
    "GITHUB_TOKEN", "JIRA_URL", "JIRA_TOKEN", "CONFLUENCE_URL", "CONFLUENCE_TOKEN",
]

# Fixed command allowlist. mode: "stream" runs to completion; "spawn" detaches a server.
ACTIONS: dict[str, dict] = {
    "install_backend": {"mode": "stream",
        "cmd": "python3 -m venv .venv && ./.venv/bin/pip install --upgrade pip -q && ./.venv/bin/pip install -r requirements.txt"},
    "install_frontend": {"mode": "stream", "cmd": "cd frontend && npm install"},
    "test": {"mode": "stream", "cmd": "ORION_LLM_CACHE_MODE=read_write ./.venv/bin/pytest -q"},
    "determinism": {"mode": "stream", "cmd": "./.venv/bin/python scripts/verify_determinism.py"},
    "reports": {"mode": "stream", "cmd": "./.venv/bin/python scripts/generate_all_phase_reports.py"},
    "start_backend": {"mode": "spawn", "cmd": "./.venv/bin/uvicorn api.main:app --port 8000",
                       "url": "http://localhost:8000/api/docs"},
    "start_frontend": {"mode": "spawn", "cmd": "npm run dev", "cwd": "frontend",
                        "url": "http://localhost:3000"},
    "compose_up": {"mode": "stream", "cmd": "docker-compose up -d"},
    "git_commit": {"mode": "stream",
        "cmd": "git init -b main 2>/dev/null; git add -A && (git commit -m 'ORION: initial commit' || echo 'nothing to commit')"},
    "github_push": {"mode": "stream",
        "cmd": "gh repo create orion-researcher --private --source=. --remote=origin --push"},
}


def _which(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def _python_311() -> bool:
    for c in ("python3.13", "python3.12", "python3.11"):
        if _which(c):
            return True
    try:
        out = subprocess.run(["python3", "--version"], capture_output=True, text=True).stdout
        m = re.search(r"3\.(\d+)", out)
        return bool(m and int(m.group(1)) >= 11)
    except Exception:
        return False


def prereqs() -> dict:
    gh = _which("gh")
    gh_auth = False
    if gh:
        gh_auth = subprocess.run(["gh", "auth", "status"], capture_output=True).returncode == 0
    return {
        "python": _which("python3"), "python_ok": _python_311(),
        "node": _which("node"), "docker": _which("docker"),
        "git": _which("git"), "gh": gh, "gh_auth": gh_auth,
    }


def read_env() -> dict:
    values = {k: "" for k in ENV_KEYS}
    placeholders = {}
    example = ROOT / ".env.example"
    if example.exists():
        for line in example.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                if k.strip() in placeholders or k.strip() in values:
                    placeholders[k.strip()] = v.strip()
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                if k.strip() in values:
                    values[k.strip()] = v.strip()
    return {"values": values, "placeholders": placeholders}


def write_env(values: dict) -> None:
    env = ROOT / ".env"
    existing = {}
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                existing[k.strip()] = v.strip()
    existing.update({k: v for k, v in values.items() if v != ""})
    lines = ["# Written by the ORION Deployment Console", ""]
    lines += [f"{k}={v}" for k, v in existing.items()]
    env.write_text("\n".join(lines) + "\n")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # quiet
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- routing ----
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self._serve_index()
        elif path == "/api/prereqs":
            self._json(prereqs())
        elif path == "/api/env":
            self._json(read_env())
        elif path == "/stream":
            self._stream(parse_qs(urlparse(self.path).query).get("action", [""])[0])
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        if urlparse(self.path).path == "/api/env":
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
            try:
                write_env(data.get("values", {}))
                self._json({"ok": True})
            except Exception as exc:
                self._json({"ok": False, "error": str(exc)}, 500)
        else:
            self._json({"error": "not found"}, 404)

    def _serve_index(self):
        html = (HERE / "index.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    # ---- SSE command streaming ----
    def _sse_init(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

    def _send(self, kind: str, line: str, event: str = "message", **extra):
        payload = {"kind": kind, "line": line, **extra}
        msg = f"event: {event}\ndata: {json.dumps(payload)}\n\n"
        try:
            self.wfile.write(msg.encode())
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            raise

    def _stream(self, action: str):
        spec = ACTIONS.get(action)
        self._sse_init()
        if not spec:
            self._send("err", f"unknown action: {action}")
            self._send("err", "", event="done", exit=1)
            return
        cwd = ROOT / spec.get("cwd", ".")
        try:
            if spec["mode"] == "spawn":
                logf = open(LOGS / f"{action}.log", "ab")
                subprocess.Popen(spec["cmd"], shell=True, cwd=str(cwd),
                                 stdout=logf, stderr=subprocess.STDOUT,
                                 start_new_session=True)
                self._send("done", f"started in background (logs: deploy/logs/{action}.log)")
                self._send("done", "", event="done", exit=0, url=spec.get("url", ""))
                return
            proc = subprocess.Popen(spec["cmd"], shell=True, cwd=str(cwd),
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, bufsize=1)
            assert proc.stdout
            for line in proc.stdout:
                self._send("log", line.rstrip("\n"))
            code = proc.wait()
            self._send("done", "", event="done", exit=code)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:
            self._send("err", str(exc))
            self._send("err", "", event="done", exit=1)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"\n  ORION Deployment Console → {url}\n  (Ctrl-C to stop)\n")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Console stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
