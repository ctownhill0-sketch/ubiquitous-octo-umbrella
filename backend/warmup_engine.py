"""
warmup_engine.py — Email Warmup Engine
Manages warmup schedules, tracks sender reputation, and simulates
warmup activity to build domain reputation before cold sending.
"""

import json
import random
import sqlite3
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional


WARMUP_DB = os.path.join(os.path.dirname(__file__), "warmup.db")

WARMUP_SCHEMA = """
CREATE TABLE IF NOT EXISTS warmup_accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT DEFAULT '',
    is_primary      INTEGER DEFAULT 0,
    warmup_active   INTEGER DEFAULT 1,
    day_number      INTEGER DEFAULT 1,
    daily_limit     INTEGER DEFAULT 5,
    total_sent      INTEGER DEFAULT 0,
    total_received  INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 50,
    added_at        TEXT,
    last_warmup_at  TEXT
);

CREATE TABLE IF NOT EXISTS warmup_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_email  TEXT,
    to_email    TEXT,
    subject     TEXT,
    direction   TEXT,  -- 'sent' or 'received'
    logged_at   TEXT
);

CREATE TABLE IF NOT EXISTS inbox_rotation (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT,
    display_name TEXT,
    is_active   INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 50,
    sent_today  INTEGER DEFAULT 0,
    last_reset  TEXT,
    added_at    TEXT
);
"""

WARMUP_SUBJECTS = [
    "Quick question",
    "Checking in",
    "Following up on our conversation",
    "Thoughts on this?",
    "Re: Our discussion",
    "A quick note",
    "Wanted to share something",
    "Have a moment?",
    "Brief update",
    "Circling back",
]

WARMUP_BODIES = [
    "Hope you're having a great week! Just wanted to touch base and see how things are going on your end.",
    "Quick note — I came across something that made me think of you. Would love to chat when you have a moment.",
    "Been meaning to reach out. Hope everything is going well! Let me know if you'd like to connect soon.",
    "Just checking in — it's been a while. Hope things are going smoothly on your end.",
    "Wanted to follow up from our last conversation. Looking forward to hearing from you.",
]


class WarmupEngine:
    def __init__(self):
        self._init_db()

    def _connect(self):
        conn = sqlite3.connect(WARMUP_DB)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.executescript(WARMUP_SCHEMA)
            conn.commit()

    # ── Account Management ────────────────────────────────────────────────────

    def add_account(self, email: str, display_name: str = "",
                    is_primary: bool = False) -> dict:
        now = datetime.now().isoformat(timespec="seconds")
        try:
            with self._connect() as conn:
                conn.execute(
                    """INSERT INTO warmup_accounts
                       (email, display_name, is_primary, warmup_active, day_number,
                        daily_limit, total_sent, total_received, reputation_score, added_at)
                       VALUES (?,?,?,1,1,5,0,0,50,?)""",
                    (email, display_name, 1 if is_primary else 0, now)
                )
                conn.commit()
            return {"success": True, "email": email}
        except sqlite3.IntegrityError:
            return {"success": False, "error": "Account already exists"}

    def get_accounts(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM warmup_accounts ORDER BY is_primary DESC, id ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    def update_account(self, email: str, patch: dict):
        allowed = {"warmup_active", "daily_limit", "display_name"}
        updates = {k: v for k, v in patch.items() if k in allowed}
        if not updates:
            return
        set_clause = ", ".join(f"{k}=?" for k in updates)
        with self._connect() as conn:
            conn.execute(
                f"UPDATE warmup_accounts SET {set_clause} WHERE email=?",
                list(updates.values()) + [email]
            )
            conn.commit()

    def remove_account(self, email: str):
        with self._connect() as conn:
            conn.execute("DELETE FROM warmup_accounts WHERE email=?", (email,))
            conn.commit()

    # ── Warmup Schedule ───────────────────────────────────────────────────────

    def get_warmup_schedule(self) -> List[dict]:
        """
        Return a 30-day warmup ramp schedule.
        Day 1-7: 5/day, Day 8-14: 15/day, Day 15-21: 30/day, Day 22-30: 50/day
        """
        schedule = []
        for day in range(1, 31):
            if day <= 7:
                limit = 5
                status = "ramp-up"
            elif day <= 14:
                limit = 15
                status = "building"
            elif day <= 21:
                limit = 30
                status = "growing"
            else:
                limit = 50
                status = "full-speed"
            schedule.append({
                "day": day,
                "daily_limit": limit,
                "status": status,
                "cumulative": sum(
                    5 * min(d, 7) + max(0, min(d - 7, 7)) * 10 +
                    max(0, min(d - 14, 7)) * 15 + max(0, min(d - 21, 9)) * 20
                    for d in range(1, day + 1)
                ) // day  # approximate
            })
        return schedule

    def simulate_warmup_activity(self) -> dict:
        """
        Simulate warmup sends for today (for demo/testing purposes).
        In production this would actually send via Gmail.
        """
        accounts = self.get_accounts()
        active = [a for a in accounts if a["warmup_active"]]
        if len(active) < 2:
            return {"sent": 0, "message": "Need at least 2 accounts for warmup"}

        now = datetime.now().isoformat(timespec="seconds")
        sent = 0
        logs = []

        for account in active:
            day = account["day_number"]
            if day <= 7:
                limit = 5
            elif day <= 14:
                limit = 15
            elif day <= 21:
                limit = 30
            else:
                limit = min(account["daily_limit"], 50)

            # Simulate sending to other accounts
            others = [a for a in active if a["email"] != account["email"]]
            sends_today = min(limit, len(others))

            for i in range(sends_today):
                target = others[i % len(others)]
                subject = random.choice(WARMUP_SUBJECTS)
                with self._connect() as conn:
                    conn.execute(
                        "INSERT INTO warmup_log (from_email, to_email, subject, direction, logged_at) VALUES (?,?,?,?,?)",
                        (account["email"], target["email"], subject, "sent", now)
                    )
                    conn.execute(
                        "UPDATE warmup_accounts SET total_sent=total_sent+1, last_warmup_at=? WHERE email=?",
                        (now, account["email"])
                    )
                    conn.commit()
                sent += 1
                logs.append(f"{account['email']} → {target['email']}: {subject}")

            # Advance day counter
            with self._connect() as conn:
                conn.execute(
                    "UPDATE warmup_accounts SET day_number=MIN(day_number+1, 30), reputation_score=MIN(reputation_score+2, 100) WHERE email=?",
                    (account["email"],)
                )
                conn.commit()

        return {"sent": sent, "logs": logs[:10]}

    def get_reputation_summary(self) -> dict:
        accounts = self.get_accounts()
        if not accounts:
            return {"avg_score": 0, "accounts": 0, "ready_to_send": False}
        avg = sum(a["reputation_score"] for a in accounts) / len(accounts)
        return {
            "avg_score": round(avg),
            "accounts": len(accounts),
            "active_warmup": sum(1 for a in accounts if a["warmup_active"]),
            "ready_to_send": avg >= 70,
            "recommendation": (
                "Domain is warmed up — safe to send cold emails at full volume." if avg >= 70
                else f"Continue warming up for {max(1, int((70 - avg) / 2))} more days before sending cold emails."
            )
        }

    # ── Inbox Rotation ────────────────────────────────────────────────────────

    def get_rotation_accounts(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM inbox_rotation WHERE is_active=1 ORDER BY sent_today ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    def add_rotation_account(self, email: str, display_name: str = "",
                              daily_limit: int = 50) -> dict:
        now = datetime.now().isoformat(timespec="seconds")
        try:
            with self._connect() as conn:
                conn.execute(
                    """INSERT INTO inbox_rotation
                       (email, display_name, is_active, daily_limit, sent_today, last_reset, added_at)
                       VALUES (?,?,1,?,0,?,?)""",
                    (email, display_name, daily_limit, now, now)
                )
                conn.commit()
            return {"success": True}
        except sqlite3.IntegrityError:
            return {"success": False, "error": "Account already in rotation"}

    def get_next_sender(self) -> Optional[dict]:
        """
        Return the rotation account with the fewest sends today
        that hasn't hit its daily limit.
        """
        today = datetime.now().date().isoformat()
        with self._connect() as conn:
            # Reset counts for accounts that haven't been reset today
            conn.execute(
                "UPDATE inbox_rotation SET sent_today=0, last_reset=? WHERE last_reset < ?",
                (today, today)
            )
            conn.commit()
            row = conn.execute(
                """SELECT * FROM inbox_rotation
                   WHERE is_active=1 AND sent_today < daily_limit
                   ORDER BY sent_today ASC LIMIT 1"""
            ).fetchone()
            return dict(row) if row else None

    def record_send(self, email: str):
        with self._connect() as conn:
            conn.execute(
                "UPDATE inbox_rotation SET sent_today=sent_today+1 WHERE email=?",
                (email,)
            )
            conn.commit()

    def get_warmup_log(self, limit: int = 50) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM warmup_log ORDER BY logged_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [dict(r) for r in rows]
