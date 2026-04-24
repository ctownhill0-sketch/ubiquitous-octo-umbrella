#!/bin/bash
# ============================================================
#  LeadStack™ — One-Command DMG Builder
#  Run this once on your Mac to produce LeadStack.dmg
#  Usage: chmod +x build_dmg.sh && ./build_dmg.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   LeadStack™ — Building macOS DMG        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org then re-run."
  exit 1
fi
echo "✓ Node $(node --version)"

# ── 2. Check Python ───────────────────────────────────────────
PYTHON=""
for cmd in python3 python3.14 python3.13 python3.12 python3.11 python3.10; do
  if command -v $cmd &>/dev/null; then
    PYTHON=$cmd
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "❌ Python 3.10+ not found. Install from https://www.python.org/downloads/ then re-run."
  exit 1
fi
echo "✓ $PYTHON ($($PYTHON --version))"

# ── 3. Install Python backend deps ───────────────────────────
echo ""
echo "→ Installing Python dependencies..."
cd backend
$PYTHON -m pip install -r requirements.txt -q
echo "→ Installing Playwright browser..."
$PYTHON -m playwright install chromium 2>/dev/null || echo "  (Playwright chromium install skipped — run manually if needed)"
cd ..

# ── 4. Install Node deps ──────────────────────────────────────
echo ""
echo "→ Installing Node.js dependencies..."
npm install --silent
cd frontend && npm install --silent && cd ..

# ── 5. Build React frontend ───────────────────────────────────
echo ""
echo "→ Building React frontend..."
cd frontend && npm run build && cd ..

# ── 6. Package as DMG ────────────────────────────────────────
echo ""
echo "→ Packaging as macOS DMG..."
npx electron-builder --mac dmg

# ── 7. Done ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅  Build complete!                    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Your DMG is in:  $(pwd)/dist/"
ls dist/*.dmg 2>/dev/null && echo "" || true
echo "Double-click the .dmg → drag LeadStack to Applications → launch!"
echo ""
