const { app, BrowserWindow, ipcMain, shell, Notification, dialog, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let backendProcess;
const BACKEND_PORT = 7432;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Find Python on macOS/Linux (tries common paths)
function findPython() {
  const { execSync } = require('child_process');
  const candidates = ['python3', 'python3.14', 'python3.13', 'python3.12', 'python3.11', 'python3.10', 'python'];
  for (const cmd of candidates) {
    try {
      const r = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim();
      if (r) return r.split('\n')[0].trim();
    } catch {}
  }
  const macPaths = [
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    '/opt/homebrew/bin/python3',
    '/Library/Frameworks/Python.framework/Versions/Current/bin/python3',
  ];
  for (const p of macPaths) { if (fs.existsSync(p)) return p; }
  return null;
}

// ─── Start Python Flask backend ───────────────────────────────────────────────
function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(process.resourcesPath, 'backend');

  const serverScript = path.join(backendPath, 'server.py');
  if (!fs.existsSync(serverScript)) {
    console.log('[backend] server.py not found at:', serverScript);
    return;
  }

  const python = findPython();
  if (!python) {
    dialog.showErrorBox(
      'Python Not Found',
      'LeadStack requires Python 3.10+.\n\nInstall from https://www.python.org/downloads/ then relaunch.'
    );
    return;
  }

  console.log('[backend] Starting:', python, serverScript);
  backendProcess = spawn(python, [serverScript], {
    cwd: backendPath,
    env: { ...process.env, LEADSTACK_PORT: String(BACKEND_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trim()));
  backendProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (!msg.includes('WARNING') && !msg.includes('Serving Flask')) console.error('[backend err]', msg);
  });
  backendProcess.on('exit', (code) => console.log('[backend] exited:', code));
}

// ─── Wait for backend to be ready ─────────────────────────────────────────────
function waitForBackend(retries = 30) {
  return new Promise((resolve) => {
    const check = (n) => {
      http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else retry(n);
      }).on('error', () => retry(n));
    };
    const retry = (n) => {
      if (n <= 0) { resolve(false); return; }
      setTimeout(() => check(n - 1), 500);
    };
    check(retries);
  });
}

// ─── Create the main window ───────────────────────────────────────────────────
async function createWindow() {
  startBackend();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#060D1A',
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // Show loading splash while backend starts
  mainWindow.loadURL('data:text/html,<!DOCTYPE html><html><head><style>body{background:%23060D1A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:-apple-system,sans-serif;color:%23fff}h1{font-size:28px;font-weight:700;margin:0 0 8px;letter-spacing:-.5px}p{font-size:14px;color:%234a6fa5;margin:0}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:%233b82f6;margin:20px 4px 0;animation:pulse 1.2s ease-in-out infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}</style></head><body><div style="text-align:center"><h1>LeadStack&#8482;</h1><p>Starting backend&hellip;</p><div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div></body></html>');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Wait for Python backend, then load the app
  const ready = await waitForBackend();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else if (ready) {
    // Load from Flask server (same origin as API calls) to avoid file:// CORS issues
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  } else {
    // Backend never came up — show a branded fallback page instead of the
    // raw Chromium "ERR_CONNECTION_REFUSED" screen.
    console.warn('[main] Backend not ready — showing fallback page');
    const fallbackHtml = `<!DOCTYPE html><html><head><title>LeadStack — Backend not ready</title>
<style>
  body{margin:0;background:#09090b;color:#f4f3ef;font-family:-apple-system,system-ui,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh}
  .card{background:#121214;border:1px solid #1c1c1f;border-radius:12px;padding:32px 36px;
        max-width:480px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  h1{margin:0 0 6px;font-size:20px;font-weight:600}
  p{margin:6px 0;color:#a1a09c;font-size:13.5px;line-height:1.6}
  code{background:#1c1c1f;padding:2px 6px;border-radius:4px;font-size:12px;color:#fbbf24}
  button{margin-top:18px;background:#f59e0b;color:#09090b;border:0;border-radius:6px;
         padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer}
  button:hover{filter:brightness(1.1)}
  .small{margin-top:12px;color:#52524e;font-size:11px}
</style></head><body>
<div class="card">
  <h1>LeadStack couldn't start its backend</h1>
  <p>The Python backend didn't respond on port ${BACKEND_PORT}. This usually means
     Python 3.10+ isn't installed or the requirements haven't been set up yet.</p>
  <p>Open Terminal, <code>cd</code> to the LeadStack folder and run:</p>
  <p><code>pip3 install -r backend/requirements.txt</code></p>
  <p>Then quit and reopen LeadStack.</p>
  <button onclick="location.reload()">Retry</button>
  <div class="small">If this keeps happening, contact support with the contents of Console.app.</div>
</div>
</body></html>`;
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fallbackHtml));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Proxy API calls to Python backend.
// The renderer also calls fetch() directly (same-origin in production), so
// this IPC bridge is for callers that need an Electron-only path. We add
// a hard timeout so a hung backend never produces a hung promise.
const API_CALL_TIMEOUT_MS = 30_000;
ipcMain.handle('api-call', async (_event, { method, endpoint, data }) => {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: endpoint,
      method: method || 'GET',
      timeout: API_CALL_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); }
        catch { resolve({ raw: responseData }); }
      });
    });

    req.on('error', (err) => reject(err.message));
    req.on('timeout', () => {
      req.destroy(new Error(`api-call timed out after ${API_CALL_TIMEOUT_MS}ms`));
    });
    if (body) req.write(body);
    req.end();
  });
});

// Open external links in browser
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

// Show native notification
ipcMain.handle('notify', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

// Open dialer
ipcMain.handle('dial', (event, phone) => {
  shell.openExternal(`tel:${phone.replace(/\D/g, '')}`);
});

// Open email client
ipcMain.handle('email', (event, { to, subject, body }) => {
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  shell.openExternal(mailto);
});

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Allow all localhost requests — critical for Flask backend communication
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* http://127.0.0.1:*; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;"
        ]
      }
    });
  });

  // Allow localhost fetch from file:// protocol
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-running-insecure-content');

  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
