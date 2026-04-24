# LeadStack™ Backend

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
playwright install chromium
```

2. Add your Gmail OAuth credentials:
   - Go to Google Cloud Console → Create OAuth 2.0 credentials
   - Download as `credentials.json` and place it in this folder
   - Run the server once to authenticate: `python server.py`
   - A browser will open for Google OAuth — authorize it

3. Add your Anthropic API key in the Settings tab of the app.

## Running

The backend starts automatically when you launch the Electron app.
To run manually: `python server.py`

## Port

Runs on `http://localhost:7432`
