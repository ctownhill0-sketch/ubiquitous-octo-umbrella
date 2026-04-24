#!/bin/bash
cd "$(dirname "$0")"
echo "================================================"
echo "  InvestReach™ Money Machine"
echo "================================================"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 not found. Install from python.org"
    exit 1
fi

# Install dependencies if needed
echo "Checking dependencies..."
pip3 install -r requirements.txt -q
python3 -m playwright install chromium --quiet 2>/dev/null

echo "Starting Money Machine..."
python3 app.py
