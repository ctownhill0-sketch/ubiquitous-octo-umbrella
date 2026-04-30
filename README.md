# LeadStack

Web-based lead-generation platform — scrape Google Maps, write AI-personalised
emails, track replies, manage your pipeline. Pure web app: no Electron, no
desktop installer, no native packaging.

## Architecture

```
leadstack/
├── frontend/             # React 19 + Vite 7 + Tailwind 4
│   ├── src/
│   │   ├── pages/        # Dashboard shell
│   │   ├── components/   # Sidebar, Header, StatusBar, CommandPalette,
│   │   │   ├── sections/ # one per feature (Leads, Pipeline, …)
│   │   │   └── ui/       # shadcn primitives
│   │   ├── lib/api.ts    # typed fetch client → backend
│   │   └── const.ts      # API_BASE (env-driven)
│   └── dist/             # vite build output
└── backend/              # Python 3.11 + Flask
    ├── server.py         # routes (port 7432, CORS-enabled)
    ├── database.py       # SQLite
    ├── scraper.py        # Google Maps via Playwright
    ├── email_writer.py   # Anthropic Claude
    └── gmail_engine.py   # Gmail API
```

## Quick start

```bash
# 1. Install
npm install                     # auto-installs frontend/ deps too
cd backend && pip3 install -r requirements.txt
playwright install chromium     # only if you need scraping locally

# 2. Configure (optional for first boot — set later in Settings)
cp frontend/.env.example frontend/.env.local
# edit frontend/.env.local if your backend isn't on localhost:7432

# 3. Run — two terminals
cd backend && python3 server.py        # → http://localhost:7432
npm run dev                            # → http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to Flask;
direct `fetch(${API_BASE}/api/...)` calls also work because Flask CORS is
enabled.

## Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VITE_API_URL` | `frontend/.env.local` | `http://localhost:7432` | Backend URL the React app fetches against. Set at build time. |
| `LEADSTACK_PORT` | backend env | `7432` | Port the Flask server binds. |
| `LEADSTACK_CORS` | backend env | `*` | Comma-separated origin allow-list. Set in production. |

### Anthropic + Gmail

- Place `credentials.json` (Google Cloud OAuth client) in `backend/`.
- Set your Anthropic API key in the app's Settings tab.

## Build for production

```bash
npm run build                  # frontend → frontend/dist/
# Flask serves frontend/dist/ as static at /, so:
cd backend && python3 server.py
# → both API and the React bundle on http://localhost:7432
```

## Deploy

**Frontend on Vercel + backend wherever:**

```bash
cd frontend
vercel --prod
# Then in Vercel project → Settings → Environment Variables:
#   VITE_API_URL = https://your-backend-host
```

**Full stack on Railway:** point Railway at this repo. It detects the Flask
backend automatically. Add a second service for the frontend (or set
`VITE_API_URL` and let Vercel handle the static build).

**Self-hosted single box:** `npm run build` → backend serves `frontend/dist`
at `/` plus `/api/*` on port 7432. Put it behind nginx/Caddy.

## Sections

| Section | Description |
|---|---|
| Dashboard | KPI strip, AI insight bar, lead-volume chart, funnel, team table |
| Leads (Pipeline) | Kanban board with drag-and-drop + lead detail split panel |
| Sequences | Visual outreach builder (email → wait → branch → linkedin) |
| Campaigns (Email) | Spintax composer, A/B test, send-window scheduler |
| Inbox (Replies) | AI intent detection, one-click reply |
| Prospector | Filter-driven B2B contact discovery |
| Scraper | Google Maps + LinkedIn lead scraping |
| Warmup | Sender reputation + inbox rotation |
| Deliverability | Spam-checker pre-send |
| Analytics | Pipeline-stage breakdown, top cities, daily trend |
| Settings | API keys, sender email, schedule, signature |

## Keyboard

- `⌘K` (Ctrl-K on Windows) — command palette, fuzzy search across sections + leads
- `⌘1`–`⌘5` — jump to Dashboard / Leads / Pipeline / Campaigns / Inbox

## Tech

React 19 · Vite 7 · Tailwind 4 · Framer Motion · Recharts · Sonner ·
Python 3.11 · Flask 3 · SQLite · Playwright · Anthropic SDK · Gmail API
