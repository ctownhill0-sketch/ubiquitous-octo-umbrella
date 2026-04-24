"""
automation.py — Master automation engine.
Runs all 5 engines on schedule using APScheduler.
Engine 1: Nightly lead scraper
Engine 2: Morning AI email sender
Engine 3: Follow-up sequence engine
Engine 4: Hourly reply monitor
Engine 5: Daily report emailer
"""

import threading
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class AutomationEngine:
    def __init__(self, db, gmail_engine, email_writer,
                 scraper_cls=None, on_log=None, on_stats_update=None):
        self.db             = db
        self.gmail          = gmail_engine
        self.writer         = email_writer
        self.scraper_cls    = scraper_cls
        self.on_log         = on_log or (lambda msg, level="info": None)
        self.on_stats_update = on_stats_update or (lambda: None)
        self.scheduler      = BackgroundScheduler(daemon=True)
        self._running       = False
        self._lock          = threading.Lock()

    # ── Scheduler Control ─────────────────────────────────────────────────────

    def start(self, settings: dict):
        """Start all automation engines based on settings."""
        if self._running:
            return
        self._settings = settings
        self._schedule_jobs(settings)
        self.scheduler.start()
        self._running = True
        self.on_log("🚀 LeadStack™ started — all engines running!", "success")

    def stop(self):
        if self._running:
            self.scheduler.shutdown(wait=False)
            self._running = False
            self.on_log("⏹ LeadStack™ stopped.", "warning")

    def is_running(self) -> bool:
        return self._running

    def _schedule_jobs(self, settings: dict):
        self.scheduler.remove_all_jobs()

        # Engine 1 — Nightly scraper (default 2:00 AM)
        scrape_hour   = int(settings.get("scrape_hour", 2))
        scrape_minute = int(settings.get("scrape_minute", 0))
        self.scheduler.add_job(
            self._run_scraper, CronTrigger(hour=scrape_hour, minute=scrape_minute),
            id="engine1_scraper", replace_existing=True,
            name="Engine 1: Nightly Lead Scraper"
        )

        # Engine 2 — Morning email sender (default 8:00 AM)
        email_hour   = int(settings.get("email_hour", 8))
        email_minute = int(settings.get("email_minute", 0))
        self.scheduler.add_job(
            self._run_email_sender, CronTrigger(hour=email_hour, minute=email_minute),
            id="engine2_sender", replace_existing=True,
            name="Engine 2: AI Email Sender"
        )

        # Engine 3 — Follow-up engine (default 9:00 AM)
        self.scheduler.add_job(
            self._run_followups, CronTrigger(hour=email_hour, minute=email_minute + 30),
            id="engine3_followups", replace_existing=True,
            name="Engine 3: Follow-up Engine"
        )

        # Engine 4 — Reply monitor (every hour)
        self.scheduler.add_job(
            self._run_reply_monitor, CronTrigger(minute=0),
            id="engine4_replies", replace_existing=True,
            name="Engine 4: Reply Monitor"
        )

        # Engine 5 — Daily report (default 9:00 AM)
        report_hour   = int(settings.get("report_hour", 9))
        report_minute = int(settings.get("report_minute", 0))
        self.scheduler.add_job(
            self._run_daily_report, CronTrigger(hour=report_hour, minute=report_minute),
            id="engine5_report", replace_existing=True,
            name="Engine 5: Daily Report"
        )

        self.on_log(
            f"Schedules set: Scraper {scrape_hour:02d}:{scrape_minute:02d} | "
            f"Emails {email_hour:02d}:{email_minute:02d} | "
            f"Report {report_hour:02d}:{report_minute:02d}", "info"
        )

    # ── Engine 1: Nightly Scraper ─────────────────────────────────────────────

    def _run_scraper(self):
        with self._lock:
            settings = self._settings
            if not self.scraper_cls:
                self.on_log("Scraper not available.", "warning")
                return

            jobs = self.db.get_pending_scraper_jobs()
            if not jobs:
                # Auto-generate jobs from saved city/keyword list
                cities   = [c.strip() for c in settings.get("cities", "").split("\n") if c.strip()]
                keywords = [k.strip() for k in settings.get("keywords", "").split("\n") if k.strip()]
                max_r    = int(settings.get("max_results_per_job", 20))

                if not cities or not keywords:
                    self.on_log("No cities/keywords configured for scraper.", "warning")
                    return

                # Pick next city in rotation
                import json
                rotation_key = "scraper_city_index"
                idx = int(self.db.get_setting(rotation_key, "0"))
                city = cities[idx % len(cities)]
                self.db.set_setting(rotation_key, str((idx + 1) % len(cities)))

                for kw in keywords:
                    self.db.create_scraper_job(kw, city, max_r)
                jobs = self.db.get_pending_scraper_jobs()

            self.on_log(f"Engine 1: Running {len(jobs)} scraper job(s)...", "info")

            for job in jobs:
                self.db.update_scraper_job(job["id"], "running")
                try:
                    def _log(cur, total, msg):
                        if msg:
                            self.on_log(f"Engine 1: {msg}", "info")
                    scraper = self.scraper_cls(
                        progress_callback=_log,
                        lead_callback=lambda lead: self.db.upsert_lead(lead)
                    )
                    results = scraper.search(
                        keyword=job["keyword"],
                        city=job["city"],
                        max_results=job["max_results"],
                        search_keyword=job["keyword"],
                        search_city=job["city"],
                    )
                    count = len(results)
                    self.db.update_scraper_job(job["id"], "completed", leads_found=count)
                    self.on_log(f"Engine 1: Scraped {count} leads for '{job['keyword']} in {job['city']}'", "success")
                except Exception as e:
                    self.db.update_scraper_job(job["id"], "failed", error=str(e))
                    self.on_log(f"Engine 1 error: {e}", "error")

            self.on_stats_update()

    # ── Engine 2: AI Email Sender ─────────────────────────────────────────────

    def _run_email_sender(self):
        with self._lock:
            settings = self._settings
            if not self.gmail.is_connected():
                self.on_log("Engine 2: Gmail not connected. Skipping.", "warning")
                return

            daily_limit = int(settings.get("daily_email_limit", 40))
            delay       = int(settings.get("send_delay_seconds", 30))
            use_ai      = settings.get("use_ai_personalisation", "true") == "true"

            # Get leads with email that haven't been emailed yet
            leads = self.db.get_leads({"has_email": True, "not_emailed": True})
            if not leads:
                self.on_log("Engine 2: No new leads to email.", "info")
                return

            self.on_log(f"Engine 2: Sending emails to {len(leads)} leads...", "info")
            templates = {
                "step1_subject": settings.get("step1_subject"),
                "step1_body":    settings.get("step1_body"),
            }
            result = self.gmail.send_batch(
                leads, self.db, self.writer,
                daily_limit=daily_limit,
                delay_seconds=delay,
                use_ai=use_ai,
                templates=templates,
            )
            self.on_log(
                f"Engine 2: Sent {result['sent']}, Failed {result['failed']}, "
                f"Skipped {result['skipped']}", "success"
            )
            self.on_stats_update()

    # ── Engine 3: Follow-up Engine ────────────────────────────────────────────

    def _run_followups(self):
        with self._lock:
            settings = self._settings
            if not self.gmail.is_connected():
                self.on_log("Engine 3: Gmail not connected. Skipping.", "warning")
                return

            daily_limit = int(settings.get("daily_email_limit", 40))
            delay       = int(settings.get("send_delay_seconds", 30))
            templates   = {
                "step2_subject": settings.get("step2_subject"),
                "step2_body":    settings.get("step2_body"),
                "step3_subject": settings.get("step3_subject"),
                "step3_body":    settings.get("step3_body"),
            }
            self.on_log("Engine 3: Processing follow-up sequences...", "info")
            result = self.gmail.process_followups(
                self.db, self.writer,
                daily_limit=daily_limit,
                delay_seconds=delay,
                templates=templates,
            )
            self.on_log(f"Engine 3: Sent {result['sent']} follow-up(s).", "success")
            self.on_stats_update()

    # ── Engine 4: Reply Monitor ───────────────────────────────────────────────

    def _run_reply_monitor(self):
        if not self.gmail.is_connected():
            return
        self.on_log("Engine 4: Checking for replies...", "info")
        hot_leads = self.gmail.check_replies(self.db, self.writer)
        if hot_leads:
            self.on_log(
                f"Engine 4: {len(hot_leads)} hot lead(s) detected! 🔥", "hot"
            )
        self.on_stats_update()

    # ── Engine 5: Daily Report ────────────────────────────────────────────────

    def _run_daily_report(self):
        with self._lock:
            settings = self._settings
            if not self.gmail.is_connected():
                self.on_log("Engine 5: Gmail not connected. Skipping report.", "warning")
                return

            report_email = settings.get("report_email", self.gmail.sender_email)
            if not report_email:
                self.on_log("Engine 5: No report email configured.", "warning")
                return

            stats = self.db.get_stats()
            today = self.db.get_today_stats()
            hot_leads = self.db.get_leads({"status": "Hot Lead"})

            combined = {
                **stats,
                "date": today["date"],
                "scraped": today["scraped"],
                "sent": today["sent"],
                "replied": today["replied"],
                "total_replies": stats["replies"],
                "total_meetings": stats["meetings"],
            }

            subject, body = self.writer.generate_daily_report(
                combined, hot_leads, report_email
            )
            result = self.gmail.send_email(report_email, subject, body, daily_limit=9999)
            if result["success"]:
                self.on_log(f"Engine 5: Daily report sent to {report_email} ✓", "success")
            else:
                self.on_log(f"Engine 5: Report failed — {result['error']}", "error")

    # ── Manual Triggers ───────────────────────────────────────────────────────

    def run_now(self, engine: int):
        """Manually trigger a specific engine in a background thread."""
        engine_map = {
            1: self._run_scraper,
            2: self._run_email_sender,
            3: self._run_followups,
            4: self._run_reply_monitor,
            5: self._run_daily_report,
        }
        fn = engine_map.get(engine)
        if fn:
            t = threading.Thread(target=fn, daemon=True)
            t.start()

    def get_next_run_times(self) -> dict:
        """Return next scheduled run times for each engine."""
        result = {}
        if not self._running:
            return result
        for job in self.scheduler.get_jobs():
            next_run = job.next_run_time
            result[job.id] = next_run.strftime("%Y-%m-%d %H:%M") if next_run else "N/A"
        return result
