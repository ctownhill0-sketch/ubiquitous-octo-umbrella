#!/bin/bash
# ============================================================
#  LeadStack™ v16 — Start Backend Server
#  The backend also serves the React frontend at http://localhost:7432
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Find Python ──────────────────────────────────────────────
PYTHON=""
for cmd in python3 python3.14 python3.13 python3.12 python3.11 python3.10; do
  if command -v $cmd &>/dev/null; then
    PYTHON=$cmd
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "❌ Python 3.10+ not found. Install from https://www.python.org/downloads/"
  exit 1
fi

echo "✓ Using $($PYTHON --version)"

# ── Install Python deps ───────────────────────────────────────
echo "Installing Python dependencies..."
$PYTHON -m pip install \
  flask flask-cors \
  anthropic \
  google-auth google-auth-oauthlib google-api-python-client \
  playwright \
  requests \
  dnspython \
  -q 2>&1 | grep -v "already satisfied" || true

# ── Install Playwright browsers (first run only) ─────────────
if ! $PYTHON -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); p.stop()" 2>/dev/null; then
  echo "Installing Playwright browser (one-time, ~100MB)..."
  $PYTHON -m playwright install chromium 2>&1 | tail -3 || true
fi

# ── Build React frontend if dist/ doesn't exist ──────────────
DIST_DIR="$SCRIPT_DIR/frontend/dist"
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "Building React frontend (first run — takes ~30s)..."
  cd frontend
  npm install --silent 2>/dev/null || true
  npm run build
  cd ..
  echo "✓ Frontend built"
fi

# ── Start Flask backend ──────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║  LeadStack™ v16 — Starting up...     ║"
echo "  ║  http://localhost:7432               ║"
echo "  ║  Keep this terminal open             ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
cd backend
$PYTHON server.py
