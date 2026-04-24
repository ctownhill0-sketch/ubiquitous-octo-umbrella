"""
deal_tracker.py — Deal Value Tracker & Pipeline Forecaster
Tracks estimated deal values, close probabilities, and revenue forecasts.
"""

import sqlite3
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional

DEAL_DB = os.path.join(os.path.dirname(__file__), "deals.db")

DEAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS deals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id         INTEGER UNIQUE,
    lead_name       TEXT,
    company         TEXT,
    deal_value      REAL DEFAULT 0,
    close_probability INTEGER DEFAULT 10,
    expected_close  TEXT,
    stage           TEXT DEFAULT 'Prospect',
    notes           TEXT DEFAULT '',
    created_at      TEXT,
    updated_at      TEXT
);
"""

# Stage → default close probability
STAGE_PROBABILITIES = {
    "Prospect": 5,
    "New": 10,
    "Emailed": 15,
    "Follow-Up Sent": 20,
    "Hot Lead": 50,
    "Meeting Booked": 70,
    "Proposal Sent": 80,
    "Negotiating": 90,
    "Closed - Won": 100,
    "Not Interested": 0,
    "Unsubscribed": 0,
}


class DealTracker:
    def __init__(self):
        self._init_db()

    def _connect(self):
        conn = sqlite3.connect(DEAL_DB)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.executescript(DEAL_SCHEMA)
            conn.commit()

    def upsert_deal(self, lead_id: int, lead_name: str, company: str,
                    deal_value: float = 0, close_probability: int = None,
                    expected_close: str = None, stage: str = "Prospect",
                    notes: str = "") -> dict:
        now = datetime.now().isoformat(timespec="seconds")
        prob = close_probability if close_probability is not None else STAGE_PROBABILITIES.get(stage, 10)
        close_date = expected_close or (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        with self._connect() as conn:
            conn.execute(
                """INSERT INTO deals
                   (lead_id, lead_name, company, deal_value, close_probability,
                    expected_close, stage, notes, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(lead_id) DO UPDATE SET
                     deal_value=excluded.deal_value,
                     close_probability=excluded.close_probability,
                     expected_close=excluded.expected_close,
                     stage=excluded.stage,
                     notes=excluded.notes,
                     updated_at=excluded.updated_at""",
                (lead_id, lead_name, company, deal_value, prob,
                 close_date, stage, notes, now, now)
            )
            conn.commit()
        return self.get_deal(lead_id)

    def get_deal(self, lead_id: int) -> Optional[dict]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM deals WHERE lead_id=?", (lead_id,)
            ).fetchone()
            return dict(row) if row else None

    def get_all_deals(self) -> List[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM deals ORDER BY close_probability DESC, deal_value DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def delete_deal(self, lead_id: int):
        with self._connect() as conn:
            conn.execute("DELETE FROM deals WHERE lead_id=?", (lead_id,))
            conn.commit()

    def get_pipeline_summary(self) -> dict:
        deals = self.get_all_deals()
        if not deals:
            return {
                "total_deals": 0,
                "total_pipeline_value": 0,
                "weighted_pipeline": 0,
                "expected_this_month": 0,
                "by_stage": {},
                "top_deals": [],
            }

        total_value = sum(d["deal_value"] for d in deals)
        weighted = sum(d["deal_value"] * d["close_probability"] / 100 for d in deals)

        # This month
        this_month = datetime.now().strftime("%Y-%m")
        month_deals = [d for d in deals if (d["expected_close"] or "").startswith(this_month)]
        expected_this_month = sum(
            d["deal_value"] * d["close_probability"] / 100 for d in month_deals
        )

        # By stage
        by_stage = {}
        for deal in deals:
            stage = deal["stage"]
            if stage not in by_stage:
                by_stage[stage] = {"count": 0, "value": 0}
            by_stage[stage]["count"] += 1
            by_stage[stage]["value"] += deal["deal_value"]

        # Top deals by weighted value
        top_deals = sorted(
            deals,
            key=lambda d: d["deal_value"] * d["close_probability"] / 100,
            reverse=True
        )[:5]

        return {
            "total_deals": len(deals),
            "total_pipeline_value": round(total_value, 2),
            "weighted_pipeline": round(weighted, 2),
            "expected_this_month": round(expected_this_month, 2),
            "by_stage": by_stage,
            "top_deals": top_deals,
            "avg_deal_value": round(total_value / len(deals), 2) if deals else 0,
        }

    def update_stage_from_lead_status(self, lead_id: int, lead_name: str,
                                       company: str, status: str):
        """Auto-update deal stage when lead status changes."""
        if status in STAGE_PROBABILITIES:
            existing = self.get_deal(lead_id)
            if existing:
                prob = STAGE_PROBABILITIES[status]
                with self._connect() as conn:
                    conn.execute(
                        """UPDATE deals SET stage=?, close_probability=?, updated_at=?
                           WHERE lead_id=?""",
                        (status, prob, datetime.now().isoformat(timespec="seconds"), lead_id)
                    )
                    conn.commit()
            else:
                # Create deal with default value
                self.upsert_deal(lead_id, lead_name, company, stage=status)
