@echo off
cd /d "%~dp0backend"
echo Installing Python dependencies...
pip install -r requirements.txt -q
echo Starting LeadStack backend on port 7432...
python server.py
pause
