#!/usr/bin/env bash
# Launch the ORION Deployment Console (Linux/macOS).
cd "$(dirname "$0")"
exec python3 deploy/console.py
