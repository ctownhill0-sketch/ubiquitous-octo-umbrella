"""
database.py — LeadStack™ SQLite persistence layer.
Stores leads, email campaigns, follow-up sequences, and daily stats.
"""

import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "money_machine.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT,
    category            TEXT,
    phone               TEXT,
    email               TEXT,
    website             TEXT,
    address             TEXT,
    city                TEXT,
    rating              TEXT,
    reviews_count       TEXT,
    linkedin            TEXT,
    google_maps_url     TEXT UNIQUE,
    lead_score          INTEGER DEFAULT 0,
    status              TEXT DEFAULT 'New',
    notes               TEXT DEFAULT '',
    search_keyword      TEXT,
    company             TEXT DEFAULT '',
    state               TEXT DEFAULT '',
    deal_value          REAL DEFAULT 0,
    close_probability   INTEGER DEFAULT 20,
    created_at          TEXT,
    updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS email_campaigns (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id             INTEGER,
    email_address       TEXT,
    subject             TEXT,
    body                TEXT,
    sequence_step       INTEGER DEFAULT 1,
    status              TEXT DEFAULT 'pending',
    scheduled_at        TEXT,
    sent_at             TEXT,
    opened_at           TEXT,
    replied_at          TEXT,
    reply_sentiment     TEXT,
    gmail_message_id    TEXT,
    gmail_thread_id     TEXT,
    created_at          TEXT,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS scraper_jobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword             TEXT,
    city                TEXT,
    max_results         INTEGER DEFAULT 20,
    status              TEXT DEFAULT 'pending',
    leads_found         INTEGER DEFAULT 0,
    scheduled_at        TEXT,
    started_at          TEXT,
    completed_at        TEXT,
    error               TEXT
);

CREATE TABLE IF NOT EXISTS daily_stats (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT UNIQUE,
    leads_scraped       INTEGER DEFAULT 0,
    emails_sent         INTEGER DEFAULT 0,
    emails_opened       INTEGER DEFAULT 0,
    replies_received    INTEGER DEFAULT 0,
    hot_leads           INTEGER DEFAULT 0,
    meetings_booked     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT
);
"""

LEAD_STATUSES = [
    "New", "Emailed", "Follow-Up Sent", "Hot Lead",
    "Meeting Booked", "Not Interested", "Unsubscribed", "Closed - Won"
]

EMAIL_STATUSES = ["pending", "sent", "opened", "replied", "bounced", "unsubscribed"]


class Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            # Migrate existing databases — add new columns if missing
            migrations = [
                "ALTER TABLE leads ADD COLUMN company TEXT DEFAULT ''",
                "ALTER TABLE leads ADD COLUMN state TEXT DEFAULT ''",
                "ALTER TABLE leads ADD COLUMN deal_value REAL DEFAULT 0",
                "ALTER TABLE leads ADD COLUMN close_probability INTEGER DEFAULT 20",
            ]
            for sql in migrations:
                try:
                    conn.execute(sql)
                except Exception:
                    pass  # Column already exists
            conn.commit()

    # ── Settings ──────────────────────────────────────────────────────────────

    def get_setting(self, key: str, default: str = "") -> str:
        with self._connect() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
            return row["value"] if row else default

    def set_setting(self, key: str, value: str):
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO settings(key,value) VALUES(?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value)
            )
            conn.commit()

    def get_all_settings(self) -> dict:
        with self._connect() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            return {r["key"]: r["value"] for r in rows}

    # ── Leads ─────────────────────────────────────────────────────────────────

    def upsert_lead(self, lead: dict) -> int:
        now = datetime.now().isoformat(timespec="seconds")
        lead.setdefault("created_at", now)
        lead["updated_at"] = now
        lead["lead_score"] = self._score_lead(lead)
        cols = ["name","category","phone","email","website","address","city",
                "rating","reviews_count","linkedin","google_maps_url",
                "lead_score","status","notes","search_keyword",
                "company","state","deal_value","close_probability",
                "created_at","updated_at"]
        values = [lead.get(c, "") for c in cols]
        placeholders = ",".join(["?"] * len(cols))
        update_str = ",".join(
            f"{c}=excluded.{c}" for c in cols
            if c not in ("id","created_at","status","notes")
        )
        sql = f"""
            INSERT INTO leads ({','.join(cols)}) VALUES ({placeholders})
            ON CONFLICT(google_maps_url) DO UPDATE SET {update_str}
        """
        with self._connect() as conn:
            cur = conn.execute(sql, values)
            conn.commit()
            return cur.lastrowid

    def _score_lead(self, lead: dict) -> int:
        score = 0
        if lead.get("phone"):   score += 30
        if lead.get("email"):   score += 25
        if lead.get("website"): score += 15
        if lead.get("linkedin"): score += 10
        try:
            if float(lead.get("rating") or 0) >= 4.0: score += 15
        except (ValueError, TypeError):
            pass
        if lead.get("address"): score += 5
        return min(score, 100)

    def get_leads(self, filters: dict = None) -> list:
        sql = "SELECT * FROM leads WHERE 1=1"
        params = []
        if filters:
            if filters.get("has_email"):
                sql += " AND email != '' AND email IS NOT NULL"
            if filters.get("status"):
                sql += " AND status = ?"
                params.append(filters["status"])
            if filters.get("not_emailed"):
                sql += " AND id NOT IN (SELECT DISTINCT lead_id FROM email_campaigns)"
            if filters.get("keyword"):
                kw = f"%{filters['keyword']}%"
                sql += " AND (name LIKE ? OR city LIKE ? OR category LIKE ?)"
                params.extend([kw, kw, kw])
        sql += " ORDER BY lead_score DESC, id DESC"
        with self._connect() as conn:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    def get_lead_by_id(self, lead_id: int) -> dict:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
            return dict(row) if row else None

    def update_lead_status(self, lead_id: int, status: str):
        with self._connect() as conn:
            conn.execute(
                "UPDATE leads SET status=?, updated_at=? WHERE id=?",
                (status, datetime.now().isoformat(timespec="seconds"), lead_id)
            )
            conn.commit()

    # ── Email Campaigns ───────────────────────────────────────────────────────

    def create_email(self, lead_id: int, email_address: str, subject: str,
                     body: str, sequence_step: int = 1,
                     scheduled_at: str = None) -> int:
        now = datetime.now().isoformat(timespec="seconds")
        scheduled = scheduled_at or now
        with self._connect() as conn:
            cur = conn.execute(
                """INSERT INTO email_campaigns
                   (lead_id, email_address, subject, body, sequence_step,
                    status, scheduled_at, created_at)
                   VALUES (?,?,?,?,?,'pending',?,?)""",
                (lead_id, email_address, subject, body, sequence_step, scheduled, now)
            )
            conn.commit()
            return cur.lastrowid

    def get_pending_emails(self) -> list:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT ec.*, l.name as lead_name, l.city as lead_city,
                          l.category as lead_category, l.rating as lead_rating,
                          l.phone as lead_phone
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.status = 'pending' AND ec.scheduled_at <= ?
                   ORDER BY ec.scheduled_at ASC""",
                (now,)
            ).fetchall()
            return [dict(r) for r in rows]

    def mark_email_sent(self, email_id: int, gmail_message_id: str = "",
                        gmail_thread_id: str = ""):
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute(
                """UPDATE email_campaigns SET status='sent', sent_at=?,
                   gmail_message_id=?, gmail_thread_id=? WHERE id=?""",
                (now, gmail_message_id, gmail_thread_id, email_id)
            )
            conn.commit()

    def mark_email_replied(self, email_id: int, sentiment: str = "unknown"):
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute(
                """UPDATE email_campaigns SET status='replied', replied_at=?,
                   reply_sentiment=? WHERE id=?""",
                (now, sentiment, email_id)
            )
            conn.commit()

    def get_emails_needing_followup(self) -> list:
        """Return leads that were emailed step 1 >= 3 days ago with no reply."""
        cutoff_step1 = (datetime.now() - timedelta(days=3)).isoformat(timespec="seconds")
        cutoff_step2 = (datetime.now() - timedelta(days=7)).isoformat(timespec="seconds")
        with self._connect() as conn:
            # Step 2 follow-ups (3 days after step 1)
            step2 = conn.execute(
                """SELECT ec.lead_id, l.email, l.name, l.city, l.category,
                          l.rating, l.reviews_count, l.phone, ec.gmail_thread_id
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.sequence_step = 1
                     AND ec.status = 'sent'
                     AND ec.sent_at <= ?
                     AND l.email != ''
                     AND ec.lead_id NOT IN (
                         SELECT lead_id FROM email_campaigns
                         WHERE sequence_step >= 2
                     )""",
                (cutoff_step1,)
            ).fetchall()
            # Step 3 breakup emails (7 days after step 1)
            step3 = conn.execute(
                """SELECT ec.lead_id, l.email, l.name, l.city, l.category,
                          l.rating, l.reviews_count, l.phone, ec.gmail_thread_id
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.sequence_step = 2
                     AND ec.status = 'sent'
                     AND ec.sent_at <= ?
                     AND l.email != ''
                     AND ec.lead_id NOT IN (
                         SELECT lead_id FROM email_campaigns
                         WHERE sequence_step >= 3
                     )""",
                (cutoff_step2,)
            ).fetchall()
        return (
            [{"step": 2, **dict(r)} for r in step2] +
            [{"step": 3, **dict(r)} for r in step3]
        )

    def get_sent_emails_for_reply_check(self) -> list:
        """Return sent emails with gmail_thread_id for reply checking."""
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT ec.id, ec.lead_id, ec.gmail_thread_id, ec.gmail_message_id,
                          ec.sequence_step, l.name, l.city
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.status = 'sent'
                     AND ec.gmail_thread_id != ''
                     AND ec.gmail_thread_id IS NOT NULL""",
            ).fetchall()
            return [dict(r) for r in rows]

    # ── Scraper Jobs ──────────────────────────────────────────────────────────

    def create_scraper_job(self, keyword: str, city: str,
                           max_results: int = 20, scheduled_at: str = None) -> int:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cur = conn.execute(
                """INSERT INTO scraper_jobs (keyword, city, max_results, status, scheduled_at)
                   VALUES (?,?,?,'pending',?)""",
                (keyword, city, max_results, scheduled_at or now)
            )
            conn.commit()
            return cur.lastrowid

    def get_pending_scraper_jobs(self) -> list:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scraper_jobs WHERE status='pending' AND scheduled_at <= ?",
                (now,)
            ).fetchall()
            return [dict(r) for r in rows]

    def update_scraper_job(self, job_id: int, status: str,
                           leads_found: int = 0, error: str = ""):
        now = datetime.now().isoformat(timespec="seconds")
        field = "started_at" if status == "running" else "completed_at"
        with self._connect() as conn:
            conn.execute(
                f"UPDATE scraper_jobs SET status=?, leads_found=?, {field}=?, error=? WHERE id=?",
                (status, leads_found, now, error, job_id)
            )
            conn.commit()

    def get_scraper_jobs(self, limit: int = 50) -> list:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scraper_jobs ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        with self._connect() as conn:
            total_leads   = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
            with_email    = conn.execute("SELECT COUNT(*) FROM leads WHERE email!=''").fetchone()[0]
            emails_sent   = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE status='sent'").fetchone()[0]
            replies       = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE status='replied'").fetchone()[0]
            hot_leads     = conn.execute("SELECT COUNT(*) FROM leads WHERE status='Hot Lead'").fetchone()[0]
            meetings      = conn.execute("SELECT COUNT(*) FROM leads WHERE status='Meeting Booked'").fetchone()[0]
            pending_emails= conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE status='pending'").fetchone()[0]
        return {
            "total_leads": total_leads,
            "with_email": with_email,
            "emails_sent": emails_sent,
            "replies": replies,
            "hot_leads": hot_leads,
            "meetings": meetings,
            "pending_emails": pending_emails,
            "open_rate": f"{round(replies/emails_sent*100)}%" if emails_sent > 0 else "0%",
        }

    def get_today_stats(self) -> dict:
        today = datetime.now().strftime("%Y-%m-%d")
        with self._connect() as conn:
            scraped = conn.execute(
                "SELECT COUNT(*) FROM leads WHERE created_at LIKE ?", (f"{today}%",)
            ).fetchone()[0]
            sent = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE sent_at LIKE ?", (f"{today}%",)
            ).fetchone()[0]
            replied = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE replied_at LIKE ?", (f"{today}%",)
            ).fetchone()[0]
        return {"date": today, "scraped": scraped, "sent": sent, "replied": replied}
