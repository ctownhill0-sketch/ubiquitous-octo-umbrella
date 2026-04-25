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

### macOS DMG

A `.dmg` can only be produced on a macOS host (electron-builder relies on
`hdiutil` and the CoreFoundation framework, which exist only on macOS). There
are two supported paths:

**1. Build locally on a Mac**

```bash
./build_dmg.sh
# DMG lands in ./dist/
```

**2. Build via GitHub Actions on a hosted macOS runner**

Push a tag of the form `vX.Y.Z` (or run the workflow manually from the Actions
tab); `.github/workflows/build-dmg.yml` builds both arm64 and x64 DMGs, uploads
them as workflow artifacts, and attaches them to a GitHub Release on tagged
builds.

```bash
git tag v1.0.0 && git push origin v1.0.0
```

### Selling the app

The DMGs produced by the steps above are **unsigned**, so Gatekeeper will warn
end users that the app is "from an unidentified developer." For paid
distribution you should:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr).
2. Add `CSC_LINK` (Developer ID `.p12`), `CSC_KEY_PASSWORD`, `APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` as repo secrets, and
   remove the `CSC_IDENTITY_AUTO_DISCOVERY: "false"` line from the workflow.
3. electron-builder will then sign and notarize automatically.

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
