#!/usr/bin/env bash
# Idempotent environment setup: venv + deps + seeded demo DB.
# Safe to run from a Claude Code SessionStart hook.
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python -m backend.app.seed
echo "Shroom OS ready. Run ./run.sh to start, or .venv/bin/python -m pytest tests/ -q"
