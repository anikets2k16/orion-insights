#!/usr/bin/env bash
# Live integration test of the Celery worker path (FR-20) via docker-compose.
# Brings up postgres+redis+api+worker, starts a research session through the API, and
# polls until the worker completes it. Requires Docker + real API keys in .env (NFR-2).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ Bringing up the stack (api + worker + redis + postgres)…"
docker-compose up -d postgres redis api worker

echo "▸ Waiting for the API to be healthy…"
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/api/health >/dev/null; then break; fi
  sleep 2
done
curl -sf http://localhost:8000/api/health | grep -q '"status":"ok"' || { echo "✗ API not healthy"; exit 1; }

echo "▸ Starting a research session (dispatched to the Celery worker)…"
SID=$(curl -sf -X POST http://localhost:8000/api/research/start \
  -H 'Content-Type: application/json' \
  -d '{"topic":"AI in drug discovery","persona":"researcher","confidence_threshold":0.7}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')
echo "  session_id=$SID"

echo "▸ Polling status until complete (worker is processing)…"
for i in $(seq 1 60); do
  STATUS=$(curl -sf "http://localhost:8000/api/research/$SID/status" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')
  echo "  [$i] status=$STATUS"
  case "$STATUS" in
    complete) echo "✓ Worker completed the session"; exit 0 ;;
    failed)   echo "✗ Session failed"; docker-compose logs worker | tail -40; exit 1 ;;
  esac
  sleep 3
done

echo "✗ Timed out waiting for completion"; docker-compose logs worker | tail -40; exit 1
