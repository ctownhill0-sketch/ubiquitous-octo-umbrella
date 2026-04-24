# LeadStack™ Desktop App

Premium lead generation platform — scrape Google Maps, write AI-personalized emails, track replies, and manage your pipeline.

## Architecture

```
leadstack_desktop/
├── electron/          # Electron main process (Node.js)
│   ├── main.js        # App lifecycle, window, IPC, backend spawn
│   └── preload.js     # Secure bridge between renderer and main
├── frontend/          # React + Vite + Tailwind UI
│   ├── src/
│   │   ├── pages/     # Dashboard page
│   │   ├── components/
│   │   │   ├── sections/   # 6 main sections
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── lib/api.ts      # API client → localhost:7432
│   └── dist/          # Built frontend (run npm run build)
└── backend/           # Python Flask API
    ├── server.py      # Flask routes (port 7432)
    ├── database.py    # SQLite persistence
    ├── scraper.py     # Google Maps Playwright scraper
    ├── email_writer.py # Claude AI email generation
    ├── gmail_engine.py # Gmail OAuth send/receive
    └── automation.py  # Scheduled automation engine
```

## Quick Start (Development)

### 1. Install dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
cd backend && pip3 install -r requirements.txt
playwright install chromium
cd ..

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure

- Place your Google Cloud OAuth `credentials.json` in `backend/`
- Set your Anthropic API key in the app Settings tab

### 3. Run

```bash
# Terminal 1: Start backend
cd backend && python3 server.py

# Terminal 2: Start Electron + React
npm run dev
```

Or use the convenience script:
```bash
./start_backend.sh  # macOS/Linux
start_backend.bat   # Windows
```

## Building for Distribution

```bash
# Build React frontend first
npm run build-react

# Package as macOS app
npm run dist
```

## Sections

| Section | Description |
|---------|-------------|
| Dashboard | KPI overview, pipeline value, activity feed |
| Scraper | Google Maps lead scraping with city targeting |
| Email | AI-personalized cold email campaigns |
| Follow-Up | Automated 3-step follow-up sequences |
| Replies | Gmail inbox monitor with AI sentiment |
| Daily Report | Performance analytics with charts |
| Settings | API keys, email config, automation params |

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion, Recharts
- **Desktop**: Electron 28
- **Backend**: Python 3.11, Flask 3, SQLite
- **Scraping**: Playwright (stealth mode)
- **AI**: Anthropic Claude (email writing)
- **Email**: Gmail API (OAuth 2.0)
