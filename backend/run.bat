@echo off
cd /d "%~dp0"
echo ================================================
echo   InvestReach(TM) Money Machine
echo ================================================
echo Checking dependencies...
pip3 install -r requirements.txt -q
python3 -m playwright install chromium
echo Starting Money Machine...
python3 app.py
pause
