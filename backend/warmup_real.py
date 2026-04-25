# LeadStack™ Real Email Warmup Engine v1.0
# Actually sends and replies to warmup emails between registered accounts.
# This is what separates real warmup from fake "simulation" warmup.
#
# How it works:
# 1. You register 2+ sending accounts (Gmail OAuth tokens)
# 2. Every day, each account sends N warmup emails to the other accounts
# 3. The other accounts auto-reply (with a random delay to look human)
# 4. Gmail's algorithm sees real send/receive/reply activity → reputation builds
# 5. After 30 days, each account can safely send 100-200 cold emails/day

import sqlite3
import smtplib
import imaplib
import email as email_lib
import random
import time
import threading
import os
import json
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "money_machine.db")

# ─── Warmup email content pools ───────────────────────────────────────────────

WARMUP_SUBJECTS = [
    "Quick follow-up",
    "Checking in",
    "Re: Our conversation",
    "Thoughts on this?",
    "Following up from last week",
    "Just wanted to share this",
    "Quick question",
    "Re: Introduction",
    "Catching up",
    "Interesting article I found",
    "Re: Next steps",
    "Wanted to loop back",
    "Brief update",
    "Re: Meeting notes",
    "Circling back",
]

WARMUP_BODIES = [
    "Hi,\n\nJust wanted to follow up on our previous conversation. Let me know if you have any questions.\n\nBest regards",
    "Hello,\n\nHope you're having a great week! I wanted to check in and see if there's anything I can help with.\n\nThanks",
    "Hi there,\n\nI came across something that might be relevant to what we discussed. Happy to share more details if useful.\n\nBest",
    "Hey,\n\nJust circling back on this. No rush, but wanted to make sure it didn't fall through the cracks.\n\nThanks",
    "Hello,\n\nQuick note — I've been thinking about what you mentioned and wanted to share a few thoughts. Let me know if you'd like to connect.\n\nBest regards",
    "Hi,\n\nHope all is well! Following up on my previous message. Looking forward to hearing from you.\n\nKind regards",
    "Hey there,\n\nJust a quick check-in. Let me know if the timing works better now.\n\nBest",
    "Hello,\n\nI wanted to reach out and see how things are going. Feel free to reply whenever convenient.\n\nThanks",
]

WARMUP_REPLIES = [
    "Thanks for reaching out! I'll get back to you shortly.",
    "Got it, thanks for the update.",
    "Appreciate you following up. I'll review this and respond soon.",
    "Thanks! This looks great. I'll take a look and get back to you.",
    "Received, thank you! I'll be in touch.",
    "Thanks for the note. I'll follow up when I have a chance to review.",
    "Great, thanks for checking in. I'll respond in detail shortly.",
    "Noted, thank you! Looking forward to connecting.",
]

# ─── DB helpers ───────────────────────────────────────────────────────────────

def ensure_warmup_tables():
    """Create warmup_accounts and warmup_log tables if missing."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS warmup_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            app_password TEXT DEFAULT '',
            active INTEGER DEFAULT 1,
            emails_sent_today INTEGER DEFAULT 0,
            emails_received_today INTEGER DEFAULT 0,
            emails_replied_today INTEGER DEFAULT 0,
            total_sent INTEGER DEFAULT 0,
            reputation_score INTEGER DEFAULT 50,
            added_at TEXT,
            last_active TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS warmup_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_email TEXT,
            to_email TEXT,
            subject TEXT,
            status TEXT,
            error TEXT DEFAULT '',
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def get_warmup_accounts() -> list[dict]:
    ensure_warmup_tables()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM warmup_accounts WHERE active = 1").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_account_stats(account_id: int, sent: int = 0, received: int = 0, replied: int = 0):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        UPDATE warmup_accounts SET
            emails_sent_today = emails_sent_today + ?,
            emails_received_today = emails_received_today + ?,
            emails_replied_today = emails_replied_today + ?,
            total_sent = total_sent + ?,
            last_active = ?
        WHERE id = ?
    """, (sent, received, replied, sent, datetime.now().isoformat(), account_id))
    conn.commit()
    conn.close()

def log_warmup_email(from_email: str, to_email: str, subject: str, status: str, error: str = ""):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO warmup_log (from_email, to_email, subject, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (from_email, to_email, subject, status, error, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def get_warmup_schedule(account_id: int) -> dict:
    """Get how many emails this account should send today based on ramp schedule."""
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT * FROM warmup_accounts WHERE id = ?", (account_id,)).fetchone()
    conn.close()
    if not row:
        return {"daily_target": 2}

    days_active = (datetime.now() - datetime.fromisoformat(row[10] or datetime.now().isoformat())).days
    # Ramp: 2 → 5 → 10 → 20 → 40 → 80 over 30 days
    if days_active < 3:
        target = 2
    elif days_active < 7:
        target = 5
    elif days_active < 14:
        target = 10
    elif days_active < 21:
        target = 20
    elif days_active < 28:
        target = 40
    else:
        target = min(80, 40 + (days_active - 28) * 5)

    return {"daily_target": target, "days_active": days_active}

# ─── SMTP/IMAP helpers ────────────────────────────────────────────────────────

def send_warmup_email(
    from_email: str,
    from_password: str,
    to_email: str,
    subject: str,
    body: str,
    smtp_host: str = "smtp.gmail.com",
    smtp_port: int = 587,
) -> bool:
    """Send a single warmup email via SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg["X-Mailer"] = "Apple Mail"  # Look like a real mail client
        msg["X-Priority"] = "3"

        # Plain text part
        text_part = MIMEText(body + "\n\n--\nSent from my iPhone", "plain")
        msg.attach(text_part)

        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.login(from_email, from_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[Warmup] SMTP error for {from_email} → {to_email}: {e}")
        return False


def check_and_reply_warmup_emails(
    account_email: str,
    account_password: str,
    all_warmup_emails: list[str],
    imap_host: str = "imap.gmail.com",
) -> int:
    """Check inbox for warmup emails and auto-reply to them."""
    replied = 0
    try:
        mail = imaplib.IMAP4_SSL(imap_host)
        mail.login(account_email, account_password)
        mail.select("inbox")

        # Search for unread emails from other warmup accounts
        since_date = (datetime.now() - timedelta(days=1)).strftime("%d-%b-%Y")
        _, msg_ids = mail.search(None, f'(UNSEEN SINCE "{since_date}")')

        for msg_id in msg_ids[0].split():
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                raw = msg_data[0][1]
                msg = email_lib.message_from_bytes(raw)

                from_addr = email_lib.utils.parseaddr(msg.get("From", ""))[1]

                # Only reply to warmup account emails
                if from_addr not in all_warmup_emails:
                    continue

                # Mark as read
                mail.store(msg_id, "+FLAGS", "\\Seen")

                # Random delay before replying (looks human)
                time.sleep(random.uniform(30, 180))

                # Send reply
                reply_body = random.choice(WARMUP_REPLIES)
                original_subject = msg.get("Subject", "Re: Hello")
                reply_subject = original_subject if original_subject.startswith("Re:") else f"Re: {original_subject}"

                success = send_warmup_email(
                    from_email=account_email,
                    from_password=account_password,
                    to_email=from_addr,
                    subject=reply_subject,
                    body=reply_body,
                )
                if success:
                    replied += 1
                    log_warmup_email(account_email, from_addr, reply_subject, "replied")

            except Exception:
                continue

        mail.logout()
    except Exception as e:
        print(f"[Warmup] IMAP error for {account_email}: {e}")

    return replied


# ─── Main warmup runner ───────────────────────────────────────────────────────

def run_warmup_cycle(stop_event: Optional[threading.Event] = None) -> dict:
    """
    Run one warmup cycle:
    1. For each active account, send N warmup emails to other accounts
    2. Check inbox and auto-reply to received warmup emails
    Returns summary of activity.
    """
    accounts = get_warmup_accounts()
    if len(accounts) < 2:
        return {"error": "Need at least 2 warmup accounts to exchange emails", "accounts": len(accounts)}

    total_sent = 0
    total_replied = 0
    errors = []
    all_emails = [a["email"] for a in accounts]

    for account in accounts:
        if stop_event and stop_event.is_set():
            break

        account_id = account["id"]
        from_email = account["email"]
        password = account.get("app_password", "")

        if not password:
            errors.append(f"{from_email}: no app password set")
            continue

        schedule = get_warmup_schedule(account_id)
        daily_target = schedule["daily_target"]

        # Pick random recipients from other warmup accounts
        other_accounts = [a for a in accounts if a["email"] != from_email]
        if not other_accounts:
            continue

        sent_today = 0
        for _ in range(daily_target):
            if stop_event and stop_event.is_set():
                break

            recipient = random.choice(other_accounts)
            to_email = recipient["email"]
            subject = random.choice(WARMUP_SUBJECTS)
            body = random.choice(WARMUP_BODIES)

            # Human-like delay between sends
            time.sleep(random.uniform(45, 180))

            success = send_warmup_email(
                from_email=from_email,
                from_password=password,
                to_email=to_email,
                subject=subject,
                body=body,
            )

            if success:
                sent_today += 1
                total_sent += 1
                log_warmup_email(from_email, to_email, subject, "sent")
            else:
                log_warmup_email(from_email, to_email, subject, "failed")
                errors.append(f"{from_email}: send failed")

        update_account_stats(account_id, sent=sent_today)

        # Check and reply to received warmup emails
        replied = check_and_reply_warmup_emails(
            account_email=from_email,
            account_password=password,
            all_warmup_emails=all_emails,
        )
        total_replied += replied
        if replied > 0:
            update_account_stats(account_id, replied=replied)

    return {
        "sent": total_sent,
        "replied": total_replied,
        "accounts_processed": len(accounts),
        "errors": errors,
        "timestamp": datetime.now().isoformat(),
    }


# ─── Background scheduler ─────────────────────────────────────────────────────

_warmup_thread: Optional[threading.Thread] = None
_warmup_stop = threading.Event()

def start_warmup_scheduler():
    """Start the background warmup scheduler (runs daily at 9am-5pm)."""
    global _warmup_thread, _warmup_stop
    _warmup_stop.clear()

    def _scheduler():
        while not _warmup_stop.is_set():
            now = datetime.now()
            # Only run during business hours
            if 9 <= now.hour < 17:
                run_warmup_cycle(_warmup_stop)
            # Sleep 4 hours between cycles
            _warmup_stop.wait(timeout=4 * 3600)

    _warmup_thread = threading.Thread(target=_scheduler, daemon=True)
    _warmup_thread.start()
    return {"started": True}

def stop_warmup_scheduler():
    global _warmup_stop
    _warmup_stop.set()
    return {"stopped": True}

def get_warmup_status() -> dict:
    ensure_warmup_tables()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    accounts = conn.execute("SELECT * FROM warmup_accounts").fetchall()
    logs = conn.execute(
        "SELECT * FROM warmup_log ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    conn.close()

    return {
        "accounts": [dict(a) for a in accounts],
        "recent_activity": [dict(l) for l in logs],
        "scheduler_running": _warmup_thread is not None and _warmup_thread.is_alive(),
    }
