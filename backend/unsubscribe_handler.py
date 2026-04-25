# LeadStack™ Unsubscribe Handler v1.0
# Handles unsubscribe requests legally and automatically.
#
# How it works:
# 1. Every outbound email gets a unique unsubscribe link: http://localhost:7432/unsubscribe?token=xxx
# 2. When clicked, the lead is marked "Unsubscribed" in the DB and never emailed again
# 3. Reply monitor detects "unsubscribe" / "remove me" intent and auto-processes it
# 4. Export includes unsubscribe list for CAN-SPAM / GDPR compliance

import sqlite3
import hashlib
import os
import secrets
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "money_machine.db")

# ─── Token generation ─────────────────────────────────────────────────────────

def generate_unsubscribe_token(lead_id: int, email: str) -> str:
    """Generate a unique, non-guessable unsubscribe token for a lead."""
    raw = f"{lead_id}:{email}:{secrets.token_hex(8)}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:32]
    # Store token in DB
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT OR REPLACE INTO unsubscribe_tokens (token, lead_id, email, created_at)
        VALUES (?, ?, ?, ?)
    """, (token, lead_id, email, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return token


def get_unsubscribe_link(lead_id: int, email: str, base_url: str = "http://localhost:7432") -> str:
    """Get a full unsubscribe URL for embedding in emails."""
    token = generate_unsubscribe_token(lead_id, email)
    return f"{base_url}/unsubscribe?token={token}"


def process_unsubscribe(token: str) -> dict:
    """Process an unsubscribe request by token. Returns result dict."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    row = conn.execute(
        "SELECT * FROM unsubscribe_tokens WHERE token = ?", (token,)
    ).fetchone()

    if not row:
        conn.close()
        return {"success": False, "error": "Invalid or expired unsubscribe link"}

    lead_id = row["lead_id"]
    email = row["email"]

    # Mark lead as unsubscribed
    conn.execute("""
        UPDATE leads SET status = 'Unsubscribed', notes = notes || ' [Unsubscribed ' || ? || ']'
        WHERE id = ? OR email = ?
    """, (datetime.now().strftime("%Y-%m-%d"), lead_id, email))

    # Log the unsubscribe
    conn.execute("""
        INSERT INTO unsubscribe_log (lead_id, email, token, unsubscribed_at)
        VALUES (?, ?, ?, ?)
    """, (lead_id, email, token, datetime.now().isoformat()))

    # Delete the token so it can't be reused
    conn.execute("DELETE FROM unsubscribe_tokens WHERE token = ?", (token,))

    conn.commit()
    conn.close()

    return {"success": True, "email": email, "message": "You have been unsubscribed successfully."}


def process_unsubscribe_by_email(email: str) -> dict:
    """Process an unsubscribe by email address directly (from reply detection)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        UPDATE leads SET status = 'Unsubscribed', notes = notes || ' [Unsubscribed via reply ' || ? || ']'
        WHERE email = ?
    """, (datetime.now().strftime("%Y-%m-%d"), email))
    _row = conn.execute("SELECT changes()").fetchone()
    affected = _row[0] if _row else 0
    conn.execute("""
        INSERT OR IGNORE INTO unsubscribe_log (lead_id, email, token, unsubscribed_at)
        VALUES (0, ?, 'reply', ?)
    """, (email, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return {"success": True, "email": email, "affected": affected}


def is_unsubscribed(email: str) -> bool:
    """Check if an email address has unsubscribed."""
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT id FROM leads WHERE email = ? AND status = 'Unsubscribed'", (email,)
    ).fetchone()
    conn.close()
    return row is not None


def get_unsubscribe_list() -> list[dict]:
    """Get all unsubscribed emails for compliance export."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT l.email, l.name, l.company, ul.unsubscribed_at
        FROM unsubscribe_log ul
        LEFT JOIN leads l ON l.email = ul.email
        ORDER BY ul.unsubscribed_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def inject_unsubscribe_footer(body: str, unsubscribe_url: str) -> str:
    """Inject a compliant unsubscribe footer into an email body."""
    footer = f"\n\n---\nTo unsubscribe from future emails, click here: {unsubscribe_url}\nThis email was sent in compliance with CAN-SPAM and GDPR regulations."
    return body + footer


def ensure_unsubscribe_tables():
    """Create unsubscribe tables if they don't exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
            token TEXT PRIMARY KEY,
            lead_id INTEGER,
            email TEXT,
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unsubscribe_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER,
            email TEXT,
            token TEXT,
            unsubscribed_at TEXT
        )
    """)
    conn.commit()
    conn.close()
