# LeadStack — Backend (Flask)

Python Flask API + SQLite + Playwright + Anthropic Claude.

## Setup

```bash
pip install -r requirements.txt
playwright install chromium     # only required for Google Maps scraping
```

## Configure

- Drop your Google Cloud OAuth `credentials.json` in this folder if you want
  the Gmail integration. Run the server once and a browser will open for the
  OAuth flow; the resulting `token.json` lands here too.
- Set the Anthropic API key inside the app's Settings tab — the backend
  reads it from the SQLite settings table at request time.

## Run

```bash
python3 server.py
# → Listening on http://localhost:7432
```

The Vite frontend (`cd ../frontend && npm run dev` on port 5173) talks to
this directly; CORS is permissive by default. In production set
`LEADSTACK_CORS=https://your.domain.com` to lock it down.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `LEADSTACK_PORT` | `7432` | Port to bind |
| `LEADSTACK_CORS` | `*` | Comma-separated allow-list of origins |

## Database files (auto-created, gitignored)

- `money_machine.db` — leads, campaigns, settings, daily stats
- `deals.db` — deal pipeline + close probabilities
- `warmup.db` — warmup accounts + reputation log
