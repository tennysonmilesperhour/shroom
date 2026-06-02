#!/usr/bin/env bash
# Launch Shroom OS (API + dashboard) on http://localhost:8000
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
fi

# Seed a demo database on first run.
if [ ! -f shroom.db ]; then
  .venv/bin/python -m backend.app.seed
fi

exec .venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
