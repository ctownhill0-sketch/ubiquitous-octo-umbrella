# LeadStack™ Gmail OAuth v2.0
# Proper OAuth 2.0 flow with automatic token refresh.
# User logs in once via browser — tokens persist forever with auto-refresh.
# No credentials.json required from the user.
#
# Setup: You (the developer) create ONE Google Cloud project with OAuth credentials.
# All users authenticate through your app — they just click "Connect Gmail".
# This is how Instantly, Lemlist, and every real email tool works.

import json
import os
import sqlite3
import threading
import webbrowser
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, urlencode
import urllib.request
import urllib.error

DB_PATH = os.path.join(os.path.dirname(__file__), "money_machine.db")

# ─── OAuth Config ─────────────────────────────────────────────────────────────
# These are YOUR app credentials from Google Cloud Console.
# Users never need to create their own Google Cloud project.
# To set up: create a project at console.cloud.google.com, enable Gmail API,
# create OAuth 2.0 credentials (Desktop app), and paste the values below.
# OR: load from environment variables for distribution.

OAUTH_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
OAUTH_REDIRECT_URI = "http://localhost:7433/oauth/callback"  # Local callback server
OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# ─── Token storage ────────────────────────────────────────────────────────────

TOKENS_PATH = os.path.join(os.path.dirname(__file__), "gmail_tokens.json")

def load_tokens() -> dict:
    if os.path.exists(TOKENS_PATH):
        with open(TOKENS_PATH) as f:
            return json.load(f)
    return {}

def save_tokens(tokens: dict):
    with open(TOKENS_PATH, "w") as f:
        json.dump(tokens, f, indent=2)

def get_token_for_email(email: str) -> dict | None:
    tokens = load_tokens()
    return tokens.get(email)

def store_token(email: str, token_data: dict):
    tokens = load_tokens()
    tokens[email] = {**token_data, "email": email, "stored_at": datetime.now().isoformat()}
    save_tokens(tokens)

def list_connected_accounts() -> list[dict]:
    tokens = load_tokens()
    accounts = []
    for email, data in tokens.items():
        accounts.append({
            "email": email,
            "connected_at": data.get("stored_at", ""),
            "expires_at": data.get("expires_at", ""),
            "valid": is_token_valid(email),
        })
    return accounts

def remove_account(email: str):
    tokens = load_tokens()
    tokens.pop(email, None)
    save_tokens(tokens)

# ─── Token refresh ────────────────────────────────────────────────────────────

def is_token_valid(email: str) -> bool:
    token = get_token_for_email(email)
    if not token:
        return False
    expires_at = token.get("expires_at")
    if not expires_at:
        return bool(token.get("access_token"))
    return datetime.fromisoformat(expires_at) > datetime.now() + timedelta(minutes=5)

def refresh_access_token(email: str) -> str | None:
    """Refresh the access token using the refresh token. Returns new access token."""
    token = get_token_for_email(email)
    if not token or not token.get("refresh_token"):
        return None

    if not OAUTH_CLIENT_ID or not OAUTH_CLIENT_SECRET:
        # Fall back to app password / direct SMTP if no OAuth credentials configured
        return token.get("access_token")

    try:
        data = urlencode({
            "client_id": OAUTH_CLIENT_ID,
            "client_secret": OAUTH_CLIENT_SECRET,
            "refresh_token": token["refresh_token"],
            "grant_type": "refresh_token",
        }).encode()

        req = urllib.request.Request(GOOGLE_TOKEN_URL, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        with urllib.request.urlopen(req, timeout=15) as resp:
            new_token = json.loads(resp.read())

        # Update stored token
        token["access_token"] = new_token["access_token"]
        token["expires_at"] = (datetime.now() + timedelta(seconds=new_token.get("expires_in", 3600))).isoformat()
        store_token(email, token)

        return new_token["access_token"]
    except Exception as e:
        print(f"[OAuth] Token refresh failed for {email}: {e}")
        return None

def get_valid_access_token(email: str) -> str | None:
    """Get a valid access token, refreshing if necessary."""
    if is_token_valid(email):
        token = get_token_for_email(email)
        return token.get("access_token") if token else None
    return refresh_access_token(email)

# ─── OAuth flow ───────────────────────────────────────────────────────────────

_oauth_state: dict = {}  # Stores pending OAuth state tokens

def build_auth_url() -> str:
    """Build the Google OAuth authorization URL."""
    state = secrets.token_urlsafe(32)
    _oauth_state["pending"] = state

    params = {
        "client_id": OAUTH_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(OAUTH_SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # Force refresh token on every auth
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    data = urlencode({
        "client_id": OAUTH_CLIENT_ID,
        "client_secret": OAUTH_CLIENT_SECRET,
        "code": code,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode()

    req = urllib.request.Request(GOOGLE_TOKEN_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req, timeout=15) as resp:
        token_data = json.loads(resp.read())

    return token_data

def get_user_info(access_token: str) -> dict:
    """Get the user's email and name from Google."""
    req = urllib.request.Request(GOOGLE_USERINFO_URL)
    req.add_header("Authorization", f"Bearer {access_token}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

# ─── Local OAuth callback server ─────────────────────────────────────────────

_oauth_result: dict = {}
_oauth_server: HTTPServer | None = None

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/oauth/callback":
            params = parse_qs(parsed.query)
            code = params.get("code", [None])[0]
            state = params.get("state", [None])[0]
            error = params.get("error", [None])[0]

            if error:
                _oauth_result["error"] = error
                self._send_html("<h2>❌ Authentication failed</h2><p>You can close this window.</p>")
            elif code and state == _oauth_state.get("pending"):
                try:
                    tokens = exchange_code_for_tokens(code)
                    user_info = get_user_info(tokens["access_token"])
                    email = user_info.get("email", "")
                    tokens["expires_at"] = (datetime.now() + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat()
                    tokens["name"] = user_info.get("name", "")
                    store_token(email, tokens)
                    _oauth_result["success"] = True
                    _oauth_result["email"] = email
                    self._send_html(f"<h2>✅ Connected: {email}</h2><p>You can close this window and return to LeadStack.</p>")
                except Exception as e:
                    _oauth_result["error"] = str(e)
                    self._send_html(f"<h2>❌ Error: {e}</h2><p>You can close this window.</p>")
            else:
                self._send_html("<h2>❌ Invalid state</h2><p>You can close this window.</p>")

            # Shut down server after handling callback
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    def _send_html(self, content: str):
        html = f"""<!DOCTYPE html>
<html><head><title>LeadStack™ — Gmail Connected</title>
<style>body{{font-family:system-ui;background:#0a0a14;color:#e8e4d8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,0.1);}}</style>
</head><body><div class="box">{content}</div></body></html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass  # Suppress server logs

def start_oauth_flow() -> dict:
    """Start the OAuth flow — opens browser, starts local callback server."""
    global _oauth_server, _oauth_result
    _oauth_result = {}

    if not OAUTH_CLIENT_ID:
        return {
            "error": "no_client_id",
            "message": "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables, or use App Password authentication instead.",
            "fallback": "app_password",
        }

    # Start local callback server
    try:
        _oauth_server = HTTPServer(("localhost", 7433), OAuthCallbackHandler)
        server_thread = threading.Thread(target=_oauth_server.serve_forever, daemon=True)
        server_thread.start()
    except OSError:
        return {"error": "port_in_use", "message": "Port 7433 is already in use"}

    # Open browser
    auth_url = build_auth_url()
    webbrowser.open(auth_url)

    return {"started": True, "auth_url": auth_url, "message": "Browser opened — complete login in the browser window"}

def poll_oauth_result(timeout: int = 120) -> dict:
    """Poll for OAuth completion result."""
    start = time.time()
    while time.time() - start < timeout:
        if _oauth_result:
            return _oauth_result
        time.sleep(0.5)
    return {"error": "timeout", "message": "OAuth flow timed out"}

# ─── Gmail API sending (using OAuth token) ───────────────────────────────────

import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email_oauth(
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    reply_to_message_id: str = None,
) -> dict:
    """Send an email using Gmail API with OAuth token."""
    access_token = get_valid_access_token(from_email)
    if not access_token:
        return {"error": "no_valid_token", "message": f"No valid token for {from_email}. Please reconnect Gmail."}

    # Build email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    if reply_to_message_id:
        msg["In-Reply-To"] = reply_to_message_id
        msg["References"] = reply_to_message_id
    msg.attach(MIMEText(body, "plain"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    # Send via Gmail API
    api_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    payload = json.dumps({"raw": raw}).encode()
    req = urllib.request.Request(api_url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
        return {"success": True, "message_id": result.get("id")}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        if "invalid_grant" in error_body or e.code == 401:
            # Token expired — try refresh
            new_token = refresh_access_token(from_email)
            if new_token:
                return send_email_oauth(from_email, to_email, subject, body, reply_to_message_id)
        return {"error": f"Gmail API error {e.code}", "detail": error_body}
    except Exception as e:
        return {"error": str(e)}

# ─── App Password fallback (for users who don't want OAuth) ──────────────────

def send_email_app_password(
    from_email: str,
    app_password: str,
    to_email: str,
    subject: str,
    body: str,
) -> dict:
    """Send email using Gmail SMTP with App Password (no OAuth needed)."""
    import smtplib
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.login(from_email, app_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def check_oauth_configured() -> dict:
    """Check if OAuth is configured and return setup instructions if not."""
    if OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET:
        return {"configured": True, "method": "oauth"}
    return {
        "configured": False,
        "method": "app_password",
        "message": "OAuth not configured. Using App Password authentication.",
        "setup_guide": {
            "step1": "Go to myaccount.google.com/security",
            "step2": "Enable 2-Step Verification",
            "step3": "Search for 'App passwords'",
            "step4": "Create an app password for 'Mail'",
            "step5": "Enter the 16-character password in LeadStack Settings",
        }
    }
