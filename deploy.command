#!/usr/bin/env bash
# Double-click this on macOS (Finder) to launch the ORION Deployment Console.
cd "$(dirname "$0")"
echo "Launching ORION Deployment Console…"
python3 deploy/console.py
