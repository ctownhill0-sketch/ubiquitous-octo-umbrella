@echo off
REM LeadStack™ Windows Build Script
REM Produces: LeadStack-Setup.exe — double-click to install
REM Requirements: Python 3.11+, Node 18+, NSIS (https://nsis.sourceforge.io/)

echo ╔══════════════════════════════════════╗
echo ║  LeadStack™ Windows Build Script v16 ║
echo ╚══════════════════════════════════════╝
echo.

REM ─── Step 1: Build React frontend ────────────────────────────────────────
echo → Building React frontend...
cd frontend
call npm install --silent
call npm run build
cd ..
echo ✓ Frontend built

REM ─── Step 2: Install Python dependencies ─────────────────────────────────
echo → Installing Python dependencies...
pip install pyinstaller flask flask-cors anthropic requests beautifulsoup4 ^
    google-auth google-auth-oauthlib google-api-python-client ^
    playwright dnspython cryptography --quiet
echo ✓ Python dependencies installed

REM ─── Step 3: Install Playwright browsers ─────────────────────────────────
echo → Installing Playwright Chromium...
python -m playwright install chromium 2>nul
echo ✓ Playwright ready

REM ─── Step 4: Build with PyInstaller ──────────────────────────────────────
echo → Building LeadStack.exe with PyInstaller...
pyinstaller leadstack.spec --clean --noconfirm
echo ✓ LeadStack.exe built

REM ─── Step 5: Create installer with NSIS ──────────────────────────────────
echo → Creating installer...
if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
    "C:\Program Files (x86)\NSIS\makensis.exe" installer.nsi
    echo ✓ LeadStack-Setup.exe created at dist\LeadStack-Setup.exe
) else (
    echo ⚠ NSIS not found — distributing LeadStack.exe directly from dist\
    echo   Install NSIS from https://nsis.sourceforge.io/ for a proper installer
)

echo.
echo ╔══════════════════════════════════════╗
echo ║  Build complete! ✓                   ║
echo ║  dist\LeadStack.exe is ready         ║
echo ╚══════════════════════════════════════╝
pause
