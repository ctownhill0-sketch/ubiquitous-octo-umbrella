#!/bin/bash
# LeadStack™ Mac Build Script
# Produces: LeadStack.dmg — drag to Applications, double-click to run
# Requirements: Python 3.11+, Node 18+, create-dmg (brew install create-dmg)

set -e

echo "╔══════════════════════════════════════╗"
echo "║   LeadStack™ Mac Build Script v16    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── Step 1: Build React frontend ────────────────────────────────────────────
echo "→ Building React frontend..."
cd frontend
npm install --silent
npm run build
cd ..
echo "✓ Frontend built"

# ─── Step 2: Install Python dependencies ─────────────────────────────────────
echo "→ Installing Python dependencies..."
pip3 install pyinstaller flask flask-cors anthropic requests beautifulsoup4 \
    google-auth google-auth-oauthlib google-api-python-client \
    playwright dnspython cryptography --quiet
echo "✓ Python dependencies installed"

# ─── Step 3: Install Playwright browsers ─────────────────────────────────────
echo "→ Installing Playwright Chromium..."
python3 -m playwright install chromium --with-deps 2>/dev/null || true
echo "✓ Playwright ready"

# ─── Step 4: Build with PyInstaller ──────────────────────────────────────────
echo "→ Building LeadStack.app with PyInstaller..."
pyinstaller leadstack.spec --clean --noconfirm
echo "✓ LeadStack.app built"

# ─── Step 5: Create .dmg ─────────────────────────────────────────────────────
echo "→ Creating LeadStack.dmg..."
if command -v create-dmg &> /dev/null; then
    create-dmg \
        --volname "LeadStack™" \
        --volicon "assets/icon.icns" \
        --window-pos 200 120 \
        --window-size 600 400 \
        --icon-size 100 \
        --icon "LeadStack.app" 175 190 \
        --hide-extension "LeadStack.app" \
        --app-drop-link 425 190 \
        --background "assets/dmg_background.png" \
        "dist/LeadStack.dmg" \
        "dist/LeadStack.app"
    echo "✓ LeadStack.dmg created at dist/LeadStack.dmg"
else
    # Fallback: simple hdiutil dmg
    hdiutil create -volname "LeadStack" -srcfolder dist/LeadStack.app \
        -ov -format UDZO dist/LeadStack.dmg
    echo "✓ LeadStack.dmg created (basic) at dist/LeadStack.dmg"
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Build complete! ✓                  ║"
echo "║   dist/LeadStack.dmg is ready        ║"
echo "║   Drag to Applications to install    ║"
echo "╚══════════════════════════════════════╝"
