"""
LeadStack™ Backend Server — v12
Flask API bridging Electron/React frontend to Python engines.
Port: 7432 (localhost only)

Fixes in v4:
- GmailEngine now auto-authenticates on first use
- EmailWriter constructed with API key from settings
- write_cold_email → generate_email (correct method name)
- send_email() return dict handled correctly (was treated as bool)
- gmail_message_id and thread_id now saved after send
- Added: POST /api/replies/sync
- Added: POST /api/replies/generate
- Added: POST /api/email/enhance
- Added: POST /api/leads/import (CSV bulk import)
- Added: POST /api/leads (create single lead)
- Added: GET  /api/email/campaigns (list campaigns)
- Added: GET  /api/analytics (full analytics data)
"""

import os, sys, csv, io, json, threading, traceback
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, Response, send_from_directory, send_file
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import Database

# Serve the built React frontend from Flask so Electron loads from http://localhost:7432
# This avoids the file:// -> http:// cross-origin fetch block in Electron
FRONTEND_DIST = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist'))
# Do NOT use static_folder here — it intercepts /api/* routes.
# Static files are served explicitly via the serve_react catch-all below.
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

db = Database()

# ── Lazy singletons ────────────────────────────────────────────────────────────
_scraper = _gmail = _email_writer = None
_gmail_lock = threading.Lock()
_writer_lock = threading.Lock()


def get_scraper():
    global _scraper
    if _scraper is None:
        from scraper import GoogleMapsScraper
        _scraper = GoogleMapsScraper()
    return _scraper


def get_gmail(force_refresh=False):
    """Return an authenticated GmailEngine, auto-authenticating if needed."""
    global _gmail
    with _gmail_lock:
        if _gmail is None or force_refresh:
            try:
                from gmail_engine import GmailEngine
                g = GmailEngine(
                    on_log=lambda msg, level="info": print(f"[Gmail/{level}] {msg}")
                )
                ok = g.authenticate()
                if ok:
                    _gmail = g
                    print("[Gmail] Authenticated successfully")
                else:
                    print("[Gmail] Authentication failed — credentials.json may be missing")
                    _gmail = g  # store anyway so we can surface errors
            except Exception as e:
                print(f"[Gmail] Init error: {e}")
        return _gmail


def get_email_writer():
    """Return an EmailWriter initialised with the current API key from settings."""
    global _email_writer
    with _writer_lock:
        api_key = db.get_setting("anthropic_api_key", "")
        if not api_key:
            return None
        # Re-create if key changed
        if _email_writer is None or getattr(_email_writer, "_api_key", "") != api_key:
            try:
                from email_writer import EmailWriter
                sender_name = db.get_setting("sender_name", "Your Name")
                product_name = db.get_setting("product_name", "LeadStack")
                product_url = db.get_setting("product_url", "")
                _email_writer = EmailWriter(
                    api_key=api_key,
                    sender_name=sender_name,
                    product_name=product_name,
                    product_url=product_url,
                )
                _email_writer._api_key = api_key
                print("[EmailWriter] Initialised with API key")
            except Exception as e:
                print(f"[EmailWriter] Init error: {e}")
        return _email_writer


# ── Job state ──────────────────────────────────────────────────────────────────
scrape_state = {
    "id": "job-0", "status": "idle", "leadsFound": 0,
    "error": None, "startedAt": None, "completedAt": None
}
scrape_lock = threading.Lock()
email_state = {
    "id": "email-0", "status": "idle", "sent": 0, "failed": 0,
    "startedAt": None, "completedAt": None
}


# ── Health ─────────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    gmail_ok = False
    try:
        g = get_gmail()
        gmail_ok = g is not None and g.service is not None
    except Exception:
        pass
    writer_ok = get_email_writer() is not None
    return jsonify({
        "status": "ok",
        "version": "16.0.0",
        "gmail": gmail_ok,
        "emailWriter": writer_ok,
        "anthropicKey": bool(db.get_setting("anthropic_api_key")),
    })


# ── Stats ──────────────────────────────────────────────────────────────────────
@app.route("/api/stats")
def get_stats():
    try:
        leads = db.get_leads()
        total = len(leads)
        with_email = sum(1 for l in leads if l.get("email"))
        hot = sum(1 for l in leads if l.get("status", "").lower() in ("hot lead", "interested"))
        meetings = sum(1 for l in leads if l.get("status", "").lower() == "meeting booked")
        today = datetime.now().strftime("%Y-%m-%d")
        with db._connect() as conn:
            emails_sent = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE status='sent'"
            ).fetchone()[0]
            emails_today = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE status='sent' AND sent_at LIKE ?",
                (today + "%",)
            ).fetchone()[0]
            leads_today = conn.execute(
                "SELECT COUNT(*) FROM leads WHERE created_at LIKE ?",
                (today + "%",)
            ).fetchone()[0]
            replies = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE status='replied'"
            ).fetchone()[0]
        open_rate = round(replies / emails_sent * 100, 1) if emails_sent > 0 else 0
        reply_rate = round(replies / emails_sent * 100, 1) if emails_sent > 0 else 0
        return jsonify({
            "totalLeads": total, "leadsToday": leads_today,
            "withEmail": with_email, "emailsSent": emails_sent,
            "emailsToday": emails_today, "openRate": open_rate,
            "replyRate": reply_rate, "hotLeads": hot,
            "meetingsBooked": meetings,
            "pipelineValue": meetings * 1500,
            "projectedRevenue": int(meetings * 495),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Leads ──────────────────────────────────────────────────────────────────────
@app.route("/api/leads")
def get_leads():
    try:
        search = request.args.get("search", "")
        status = request.args.get("status", "")
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
        filters = {}
        if status:
            filters["status"] = status
        if search:
            filters["keyword"] = search
        all_leads = db.get_leads(filters)
        total = len(all_leads)
        page = all_leads[offset:offset + limit]
        out = [{
            "id": l.get("id"), "name": l.get("name", ""),
            "phone": l.get("phone", ""), "email": l.get("email", ""),
            "website": l.get("website", ""), "address": l.get("address", ""),
            "city": l.get("city", ""), "rating": l.get("rating"),
            "reviews": l.get("reviews_count"), "category": l.get("category", ""),
            "maps_url": l.get("google_maps_url", ""),
            "score": l.get("lead_score", 0), "status": l.get("status", "New"),
            "notes": l.get("notes", ""), "created_at": l.get("created_at", ""),
            "updated_at": l.get("updated_at", ""),
            "last_contacted": l.get("updated_at", ""), "email_step": 0,
            "company": l.get("company", ""),
            "deal_value": l.get("deal_value", 0),
            "close_probability": l.get("close_probability", 20),
            "emails_sent": l.get("emails_sent", 0),
        } for l in page]
        return jsonify({"leads": out, "total": total})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/leads", methods=["POST"])
def create_lead():
    """Create a single lead manually."""
    try:
        data = request.json or {}
        lead_id = db.upsert_lead(data)
        return jsonify({"id": lead_id, "ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/leads/<int:lead_id>", methods=["PATCH"])
def update_lead(lead_id):
    try:
        data = request.json or {}
        allowed = ("notes", "status", "name", "email", "phone", "website", "city", "category", "company", "state", "deal_value", "close_probability")
        db_data = {k: v for k, v in data.items() if k in allowed}
        if db_data:
            with db._connect() as conn:
                sets = ", ".join(f"{k}=?" for k in db_data)
                conn.execute(
                    f"UPDATE leads SET {sets}, updated_at=? WHERE id=?",
                    list(db_data.values()) + [datetime.now().isoformat(timespec="seconds"), lead_id]
                )
                conn.commit()
        return jsonify(db.get_lead_by_id(lead_id) or {"id": lead_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/leads/<int:lead_id>", methods=["DELETE"])
def delete_lead(lead_id):
    try:
        with db._connect() as conn:
            conn.execute("DELETE FROM leads WHERE id=?", (lead_id,))
            conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/leads/export")
def export_leads():
    try:
        leads = db.get_leads()
        output = io.StringIO()
        if leads:
            fn = ["id", "name", "phone", "email", "website", "address", "city",
                  "rating", "reviews_count", "category", "google_maps_url",
                  "lead_score", "status", "notes", "created_at"]
            w = csv.DictWriter(output, fieldnames=fn, extrasaction="ignore")
            w.writeheader()
            w.writerows(leads)
        return Response(
            output.getvalue(), mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=leadstack_leads.csv"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/search")
def search_global():
    """Global search across leads by name, email, category, city."""
    q = request.args.get("q", "").strip().lower()
    if not q or len(q) < 2:
        return jsonify({"results": []})
    try:
        with db._connect() as conn:
            rows = conn.execute(
                """SELECT id, name, category, email, phone, website, city, lead_score, status
                   FROM leads
                   WHERE lower(name) LIKE ? OR lower(email) LIKE ? OR lower(category) LIKE ?
                      OR lower(city) LIKE ? OR lower(phone) LIKE ?
                   LIMIT 20""",
                (f"%{q}%",) * 5
            ).fetchall()
        results = [
            {"id": r[0], "name": r[1], "category": r[2], "email": r[3],
             "phone": r[4], "website": r[5], "city": r[6],
             "score": r[7], "status": r[8]}
            for r in rows
        ]
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"results": [], "error": str(e)})


@app.route("/api/leads/bulk-update", methods=["POST"])
def bulk_update_leads():
    """Bulk update status or delete multiple leads."""
    data = request.json or {}
    ids = data.get("ids", [])
    action = data.get("action", "")  # 'move', 'delete', 'export'
    stage = data.get("stage", "")
    if not ids:
        return jsonify({"ok": False, "error": "No IDs provided"}), 400
    try:
        with db._connect() as conn:
            if action == "delete":
                conn.executemany("DELETE FROM leads WHERE id=?", [(i,) for i in ids])
                conn.commit()
                return jsonify({"ok": True, "affected": len(ids), "action": "delete"})
            elif action == "move" and stage:
                conn.executemany(
                    "UPDATE leads SET status=?, updated_at=? WHERE id=?",
                    [(stage, datetime.now().isoformat(timespec="seconds"), i) for i in ids]
                )
                conn.commit()
                return jsonify({"ok": True, "affected": len(ids), "action": "move", "stage": stage})
            elif action == "export":
                rows = conn.execute(
                    f"SELECT * FROM leads WHERE id IN ({','.join('?' for _ in ids)})", ids
                ).fetchall()
                output = io.StringIO()
                if rows:
                    fn = list(rows[0].keys())
                    w = csv.DictWriter(output, fieldnames=fn, extrasaction="ignore")
                    w.writeheader()
                    w.writerows([dict(r) for r in rows])
                return Response(
                    output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=selected_leads.csv"}
                )
            else:
                return jsonify({"ok": False, "error": f"Unknown action: {action}"}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/leads/<int:lead_id>/score", methods=["POST"])
def update_lead_score(lead_id):
    """Increment lead score when an email is opened, replied to, or clicked."""
    data = request.json or {}
    event = data.get("event", "open")  # 'open', 'reply', 'click', 'meeting'
    points = {"open": 10, "reply": 25, "click": 15, "meeting": 50}.get(event, 5)
    try:
        with db._connect() as conn:
            conn.execute(
                "UPDATE leads SET lead_score = MIN(100, COALESCE(lead_score,0) + ?), updated_at=? WHERE id=?",
                (points, datetime.now().isoformat(timespec="seconds"), lead_id)
            )
            conn.commit()
            row = conn.execute("SELECT lead_score FROM leads WHERE id=?", (lead_id,)).fetchone()
        return jsonify({"ok": True, "lead_id": lead_id, "event": event,
                        "points_added": points, "new_score": row[0] if row else None})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/campaigns/ab-result", methods=["POST"])
def ab_result():
    """Record A/B test result for a campaign (which subject variant was used)."""
    data = request.json or {}
    campaign_id = data.get("campaign_id")
    variant = data.get("variant", "A")  # 'A' or 'B'
    event = data.get("event", "sent")   # 'sent', 'opened', 'replied'
    try:
        with db._connect() as conn:
            # Store variant in notes column as JSON metadata
            conn.execute(
                "UPDATE email_campaigns SET notes=json_patch(COALESCE(notes,'{}'), ?) WHERE id=?",
                (json.dumps({"ab_variant": variant, "ab_event": event}), campaign_id)
            )
            conn.commit()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/api/leads/import", methods=["POST"])
def import_leads():
    """Bulk import leads from a JSON array or CSV text body."""
    try:
        imported = 0
        skipped = 0
        content_type = request.content_type or ""

        if "application/json" in content_type:
            rows = request.json or []
            for row in rows:
                try:
                    db.upsert_lead(row)
                    imported += 1
                except Exception:
                    skipped += 1

        elif "text/csv" in content_type or "multipart" in content_type:
            # Handle raw CSV text
            raw = request.data.decode("utf-8", errors="replace")
            reader = csv.DictReader(io.StringIO(raw))
            for row in reader:
                try:
                    # Normalise common header names
                    lead = {
                        "name": row.get("name") or row.get("Name") or row.get("Business Name") or "",
                        "email": row.get("email") or row.get("Email") or "",
                        "phone": row.get("phone") or row.get("Phone") or "",
                        "website": row.get("website") or row.get("Website") or "",
                        "address": row.get("address") or row.get("Address") or "",
                        "city": row.get("city") or row.get("City") or "",
                        "category": row.get("category") or row.get("Category") or row.get("Industry") or "",
                        "notes": row.get("notes") or row.get("Notes") or "",
                    }
                    if lead["name"] or lead["email"]:
                        db.upsert_lead(lead)
                        imported += 1
                    else:
                        skipped += 1
                except Exception:
                    skipped += 1
        else:
            return jsonify({"error": "Send JSON array or CSV text/csv"}), 400

        return jsonify({"imported": imported, "skipped": skipped, "ok": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Scraper ────────────────────────────────────────────────────────────────────
@app.route("/api/scrape/start", methods=["POST"])
def start_scrape():
    global scrape_state
    with scrape_lock:
        if scrape_state["status"] == "running":
            return jsonify({"error": "Scrape already running"}), 400
    body = request.json or {}
    keyword = body.get("keyword", "independent financial advisor")
    cities = body.get("cities", ["New York, NY"])
    max_per_city = int(body.get("maxPerCity", 20))
    job_id = f"job-{int(datetime.now().timestamp())}"
    with scrape_lock:
        scrape_state.update({
            "id": job_id, "keyword": keyword, "cities": cities,
            "status": "running", "leadsFound": 0, "error": None,
            "startedAt": datetime.now().isoformat(), "completedAt": None
        })

    def run():
        global scrape_state
        total = 0
        try:
            scraper = get_scraper()
            for city in cities:
                with scrape_lock:
                    if scrape_state["status"] != "running":
                        break
                try:
                    leads = scraper.search(keyword, city, max_results=max_per_city)
                    for lead in leads:
                        db.upsert_lead(lead)
                        total += 1
                        with scrape_lock:
                            scrape_state["leadsFound"] = total
                except Exception as e:
                    print(f"[Scraper] Error in {city}: {e}")
        except Exception as e:
            with scrape_lock:
                scrape_state.update({"error": str(e), "status": "failed"})
            return
        with scrape_lock:
            if scrape_state["status"] == "running":
                scrape_state["status"] = "completed"
            scrape_state.update({"leadsFound": total, "completedAt": datetime.now().isoformat()})

    threading.Thread(target=run, daemon=True).start()
    return jsonify(dict(scrape_state))


@app.route("/api/scrape/status")
def scrape_status():
    with scrape_lock:
        return jsonify(dict(scrape_state))


@app.route("/api/scrape/stop", methods=["POST"])
def stop_scrape():
    global scrape_state
    with scrape_lock:
        scrape_state.update({"status": "stopped", "error": "Stopped by user"})
    return jsonify({"ok": True})


# ── Email Engine ───────────────────────────────────────────────────────────────
@app.route("/api/email/status")
def email_status():
    return jsonify(dict(email_state))


@app.route("/api/email/campaigns")
def get_campaigns():
    """Return a summary of email campaigns grouped by status."""
    try:
        with db._connect() as conn:
            rows = conn.execute("""
                SELECT ec.id, ec.lead_id, l.name as lead_name, ec.email_address,
                       ec.subject, ec.status, ec.sequence_step,
                       ec.sent_at, ec.replied_at, ec.reply_sentiment
                FROM email_campaigns ec
                JOIN leads l ON ec.lead_id = l.id
                ORDER BY ec.sent_at DESC LIMIT 200
            """).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/email/send", methods=["POST"])
def send_emails():
    global email_state
    if email_state["status"] == "running":
        return jsonify({"error": "Already running"}), 400
    body = request.json or {}
    step = int(body.get("step", 1))
    job_id = f"email-{int(datetime.now().timestamp())}"
    email_state.update({
        "id": job_id, "status": "running", "sent": 0, "failed": 0,
        "startedAt": datetime.now().isoformat(), "completedAt": None
    })

    ab_test = bool(body.get("abTest", False))
    subject_a = (body.get("subject") or "").strip()
    subject_b = (body.get("subjectB") or "").strip()
    body_override = (body.get("body") or "").strip()
    schedule = body.get("schedule")  # {startHour, endHour, days: [0..6]}
    daily_cap_override = int(body.get("maxEmails", 0)) or None

    def _spin(text):
        """Parse spintax: {option1|option2|option3} → random choice."""
        import re, random
        return re.sub(r'\{([^{}]+)\}', lambda m: random.choice(m.group(1).split('|')), text)

    def run():
        global email_state
        sent = failed = 0
        try:
            gmail = get_gmail()
            writer = get_email_writer()
            # Check if we should fall back to SMTP App Password
            use_smtp = False
            smtp_email = db.get_setting("sender_email", "")
            smtp_password = db.get_setting("gmail_app_password", "")
            if not gmail or not gmail.service:
                if smtp_email and smtp_password:
                    use_smtp = True  # Fall back to SMTP
                else:
                    email_state.update({"status": "error", "error": "Gmail not connected — enter your Gmail App Password in Settings"})
                    return
            if not writer:
                email_state.update({"status": "error", "error": "Anthropic API key not set in Settings"})
                return
            settings = db.get_all_settings()
            max_per_day = daily_cap_override or int(settings.get("max_emails_per_day", "50"))
            # Respect send schedule
            if schedule:
                now_h = datetime.now().hour
                now_wd = datetime.now().weekday()  # 0=Mon
                # JS weekday: 0=Sun, 1=Mon ... 6=Sat → convert to Python 0=Mon
                allowed_js = [int(d) for d in (schedule.get("days") or [1,2,3,4,5])]
                py_allowed = [(d - 1) % 7 for d in allowed_js]
                start_h = int(schedule.get("startHour", 8))
                end_h = int(schedule.get("endHour", 18))
                if now_wd not in py_allowed or not (start_h <= now_h < end_h):
                    email_state.update({"status": "scheduled",
                                        "error": f"Outside send window ({start_h}:00–{end_h}:00 on selected days)"})
                    return
            leads = db.get_leads({"has_email": True, "not_emailed": True})
            for idx, lead in enumerate(leads[:max_per_day]):
                try:
                    # A/B testing: alternate subject lines
                    gen_subject, gen_body = writer.generate_email(lead, step=step)
                    # Choose subject
                    if ab_test and subject_b and idx % 2 == 1:
                        subject = _spin(subject_b)
                        variant = "B"
                    elif subject_a:
                        subject = _spin(subject_a)
                        variant = "A"
                    else:
                        subject = gen_subject
                        variant = "A"
                    # Choose body
                    if body_override:
                        body_text = _spin(body_override)
                        # Fill template variables
                        first = (lead.get('name') or '').split()[0] if lead.get('name') else 'there'
                        body_text = body_text.replace('{{first_name}}', first)
                        body_text = body_text.replace('{{company}}', lead.get('name', ''))
                        body_text = body_text.replace('{{website}}', lead.get('website', ''))
                        body_text = body_text.replace('{{sender_name}}', settings.get('sender_name', ''))
                        body_text = body_text.replace('{{city}}', lead.get('city', ''))
                        body_text = body_text.replace('{{category}}', lead.get('category', ''))
                    else:
                        body_text = gen_body
                    # Inject unsubscribe link
                    try:
                        from unsubscribe_handler import get_unsubscribe_link, ensure_unsubscribe_tables
                        ensure_unsubscribe_tables()
                        unsub_link = get_unsubscribe_link(lead["id"], lead["email"])
                        body_text = body_text + f"\n\n---\nTo unsubscribe: {unsub_link}"
                    except Exception:
                        pass  # Don't block sending if unsubscribe fails
                    if use_smtp:
                        # SMTP fallback using App Password
                        import smtplib
                        from email.mime.text import MIMEText as _MIMEText
                        from email.mime.multipart import MIMEMultipart as _MIME
                        try:
                            msg = _MIME("alternative")
                            msg["To"] = lead["email"]
                            msg["From"] = smtp_email
                            msg["Subject"] = subject
                            msg.attach(_MIMEText(body_text, "plain"))
                            with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as srv:
                                srv.ehlo()
                                srv.starttls()
                                srv.login(smtp_email, smtp_password)
                                srv.sendmail(smtp_email, lead["email"], msg.as_string())
                            result = {"success": True, "message_id": "", "thread_id": ""}
                        except Exception as smtp_err:
                            result = {"success": False, "error": str(smtp_err)}
                    else:
                        result = gmail.send_email(
                            to=lead["email"],
                            subject=subject,
                            body=body_text,
                        )
                    if result.get("success"):
                        email_id = db.create_email(
                            lead_id=lead["id"],
                            email_address=lead["email"],
                            subject=subject,
                            body=body_text,
                            sequence_step=step,
                        )
                        # Save Gmail IDs + A/B variant so we can track replies later
                        with db._connect() as conn:
                            conn.execute(
                                "UPDATE email_campaigns SET status='sent', sent_at=?, "
                                "gmail_message_id=?, gmail_thread_id=?, notes=? WHERE id=?",
                                (
                                    datetime.now().isoformat(timespec="seconds"),
                                    result.get("message_id", ""),
                                    result.get("thread_id", ""),
                                    json.dumps({"ab_variant": variant}) if ab_test else None,
                                    email_id,
                                )
                            )
                            conn.commit()
                        # Auto-update lead score: +5 for being emailed
                        try:
                            with db._connect() as conn:
                                conn.execute(
                                    "UPDATE leads SET lead_score = MIN(100, COALESCE(lead_score,0) + 5) WHERE id=?",
                                    (lead["id"],)
                                )
                                conn.commit()
                        except Exception:
                            pass
                        sent += 1
                    else:
                        print(f"[Email] Send failed for {lead.get('name')}: {result.get('error')}")
                        failed += 1
                except Exception as e:
                    print(f"[Email] Error for {lead.get('name')}: {e}")
                    failed += 1
                email_state["sent"] = sent
                email_state["failed"] = failed
        except Exception as e:
            traceback.print_exc()
            email_state.update({"status": "error", "error": str(e)})
            return
        email_state.update({"status": "done", "completedAt": datetime.now().isoformat()})

    threading.Thread(target=run, daemon=True).start()
    return jsonify(dict(email_state))


@app.route("/api/email/enhance", methods=["POST"])
def enhance_email():
    """Use Claude to improve a draft email body."""
    try:
        body = request.json or {}
        draft = body.get("body", "")
        context = body.get("context", "")
        if not draft:
            return jsonify({"error": "No draft provided"}), 400
        writer = get_email_writer()
        if not writer:
            return jsonify({"error": "Anthropic API key not configured in Settings"}), 400
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=writer.api_key)
            prompt = f"""You are an expert cold email copywriter. Improve this email draft to be more compelling, concise, and personalized. Keep it under 150 words. Return ONLY the improved email body, no commentary.

Context: {context}

Draft:
{draft}"""
            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )
            enhanced = message.content[0].text.strip()
            return jsonify({"body": enhanced, "enhanced": enhanced})
        except Exception as e:
            return jsonify({"error": f"AI enhancement failed: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/email/ai-generate", methods=["POST"])
def ai_generate_email():
    """Generate a full cold email for a specific lead."""
    try:
        body = request.json or {}
        lead_id = body.get("lead_id")
        step = int(body.get("step", 1))
        lead = db.get_lead_by_id(lead_id) if lead_id else body.get("lead", {})
        if not lead:
            return jsonify({"error": "Lead not found"}), 404
        writer = get_email_writer()
        if not writer:
            return jsonify({"error": "Anthropic API key not configured in Settings"}), 400
        subject, email_body = writer.generate_email(lead, step=step)
        return jsonify({"subject": subject, "body": email_body})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Replies ────────────────────────────────────────────────────────────────────
@app.route("/api/replies")
def get_replies():
    try:
        with db._connect() as conn:
            rows = conn.execute("""
                SELECT ec.id, ec.lead_id, l.name as leadName, l.name as company,
                       ec.email_address as email, ec.subject,
                       COALESCE(ec.reply_sentiment, 'unknown') as sentiment,
                       ec.replied_at as receivedAt, ec.sequence_step as step,
                       CASE WHEN ec.reply_sentiment IN ('Positive','interested') THEN 1 ELSE 0 END as isHot,
                       0 as isRead, '' as preview
                FROM email_campaigns ec
                JOIN leads l ON ec.lead_id = l.id
                WHERE ec.status = 'replied'
                ORDER BY ec.replied_at DESC LIMIT 100
            """).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception:
        return jsonify([])


@app.route("/api/replies/<int:reply_id>/read", methods=["POST"])
def mark_reply_read(reply_id):
    return jsonify({"ok": True})


@app.route("/api/replies/sync", methods=["GET", "POST"])
def sync_replies():
    """Check Gmail for new replies and classify them with AI."""
    try:
        gmail = get_gmail()
        if not gmail or not gmail.service:
            return jsonify({"new_replies": 0, "checked": 0,
                            "error": "Gmail not authenticated"}), 200
        threads = db.get_sent_emails_for_reply_check()
        new_replies = 0
        writer = get_email_writer()
        for t in threads:
            try:
                reply = gmail.check_thread_for_reply(
                    t.get("gmail_thread_id", ""),
                    t.get("gmail_message_id", "")
                )
                if reply and reply.get("has_reply"):
                    # Classify intent with AI if available
                    reply_body = reply.get("reply_text", "")
                    sentiment = "unknown"
                    if writer and reply_body:
                        try:
                            sentiment = writer.analyse_reply_sentiment(reply_body)
                        except Exception:
                            pass
                    with db._connect() as conn:
                        conn.execute(
                            "UPDATE email_campaigns SET status='replied', replied_at=?, "
                            "reply_sentiment=? WHERE id=?",
                            (datetime.now().isoformat(), sentiment, t["id"])
                        )
                        conn.commit()
                    new_replies += 1
            except Exception as e:
                print(f"[Replies] Thread check error: {e}")
        return jsonify({"new_replies": new_replies, "checked": len(threads)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"new_replies": 0, "error": str(e)})


@app.route("/api/replies/check", methods=["POST"])
def check_replies():
    """Alias for /api/replies/sync (backwards compat)."""
    return sync_replies()


@app.route("/api/replies/generate", methods=["POST"])
def generate_reply():
    """Generate an AI reply to a received email."""
    try:
        body = request.json or {}
        thread_body = body.get("body", "")
        intent = body.get("intent", "unknown")
        lead_name = body.get("lead_name", "")
        first_name = lead_name.split()[0] if lead_name else "there"
        writer = get_email_writer()
        if not writer:
            return jsonify({"error": "Anthropic API key not configured in Settings"}), 400
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=writer.api_key)
            sender_name = db.get_setting("sender_name", "Your Name")
            prompt = f"""You are a professional sales rep writing a reply to a cold email response.

The reply you received (intent: {intent}):
{thread_body}

Write a short, natural, professional reply from {sender_name}. Match the intent:
- interested/question: enthusiastic, suggest a call, keep it brief
- not_now: gracious, leave door open for Q3/Q4
- meeting_booked: confirm the meeting, send calendar invite mention
- unsubscribe: apologize briefly, confirm removal

Return ONLY the email body text, no subject line, no commentary. Under 100 words."""
            message = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )
            reply_text = message.content[0].text.strip()
            return jsonify({"reply": reply_text})
        except Exception as e:
            return jsonify({"error": f"AI generation failed: {e}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Analytics ──────────────────────────────────────────────────────────────────
@app.route("/api/analytics")
def get_analytics():
    """Full analytics data for the Analytics section."""
    try:
        today = datetime.now()
        with db._connect() as conn:
            # 30-day trend
            trend = []
            for i in range(29, -1, -1):
                d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
                dn = (today - timedelta(days=i)).strftime("%b %d")
                ld = conn.execute("SELECT COUNT(*) FROM leads WHERE created_at LIKE ?", (d + "%",)).fetchone()[0]
                ed = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE sent_at LIKE ?", (d + "%",)).fetchone()[0]
                rd = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE replied_at LIKE ?", (d + "%",)).fetchone()[0]
                trend.append({"date": dn, "leads": ld, "emails": ed, "replies": rd})

            # Top cities
            cities = conn.execute(
                "SELECT city, COUNT(*) as count FROM leads WHERE city!='' GROUP BY city ORDER BY count DESC LIMIT 8"
            ).fetchall()

            # Pipeline stages
            stages = conn.execute(
                "SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC"
            ).fetchall()

            # Email performance
            total_sent = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE status='sent'").fetchone()[0]
            total_replied = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE status='replied'").fetchone()[0]
            total_leads = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]

        return jsonify({
            "trend": trend,
            "topCities": [{"city": r["city"], "count": r["count"]} for r in cities],
            "pipelineStages": [{"stage": r["status"], "count": r["count"]} for r in stages],
            "summary": {
                "totalLeads": total_leads,
                "totalEmailsSent": total_sent,
                "totalReplies": total_replied,
                "openRate": round(total_replied / total_sent * 100, 1) if total_sent > 0 else 0,
                "replyRate": round(total_replied / total_sent * 100, 1) if total_sent > 0 else 0,
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Daily Report ───────────────────────────────────────────────────────────────
def _build_report():
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        with db._connect() as conn:
            new_leads = conn.execute(
                "SELECT COUNT(*) FROM leads WHERE created_at LIKE ?", (today + "%",)
            ).fetchone()[0]
            emails_sent = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE sent_at LIKE ?", (today + "%",)
            ).fetchone()[0]
            replies = conn.execute(
                "SELECT COUNT(*) FROM email_campaigns WHERE replied_at LIKE ?", (today + "%",)
            ).fetchone()[0]
            hot = conn.execute(
                "SELECT COUNT(*) FROM leads WHERE status IN ('Hot Lead','Interested','Meeting Booked')"
            ).fetchone()[0]
            weekly = []
            for i in range(6, -1, -1):
                d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                dn = (datetime.now() - timedelta(days=i)).strftime("%a")
                ld = conn.execute("SELECT COUNT(*) FROM leads WHERE created_at LIKE ?", (d + "%",)).fetchone()[0]
                ed = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE sent_at LIKE ?", (d + "%",)).fetchone()[0]
                rd = conn.execute("SELECT COUNT(*) FROM email_campaigns WHERE replied_at LIKE ?", (d + "%",)).fetchone()[0]
                weekly.append({"day": dn, "leads": ld, "emails": ed, "replies": rd})
            city_rows = conn.execute(
                "SELECT city, COUNT(*) as leads FROM leads WHERE city!='' GROUP BY city ORDER BY leads DESC LIMIT 5"
            ).fetchall()
            top_cities = [{"city": r["city"], "leads": r["leads"], "emails": 0, "replies": 0} for r in city_rows]
        reply_rate = round(replies / emails_sent * 100, 1) if emails_sent > 0 else 0
        return {
            "date": today, "newLeads": new_leads, "emailsSent": emails_sent,
            "emailsOpened": 0, "repliesReceived": replies, "hotLeads": hot,
            "openRate": 0, "replyRate": reply_rate,
            "weeklyData": weekly, "topCities": top_cities,
            "summary": (
                f"Today ({today}): {new_leads} new leads, {emails_sent} emails sent, "
                f"{replies} replies. Reply rate: {reply_rate}%."
            ),
        }
    except Exception as e:
        return {
            "date": today, "newLeads": 0, "emailsSent": 0, "emailsOpened": 0,
            "repliesReceived": 0, "hotLeads": 0, "openRate": 0, "replyRate": 0,
            "weeklyData": [], "topCities": [], "summary": f"Error: {e}"
        }


@app.route("/api/report/daily")
def daily_report():
    return jsonify(_build_report())


@app.route("/api/report/generate", methods=["POST"])
def generate_report():
    report = _build_report()
    try:
        with db._connect() as conn:
            conn.execute(
                """INSERT INTO daily_stats
                   (date, leads_scraped, emails_sent, emails_opened, replies_received, hot_leads)
                   VALUES (?,?,?,?,?,?)
                   ON CONFLICT(date) DO UPDATE SET
                     leads_scraped=excluded.leads_scraped,
                     emails_sent=excluded.emails_sent,
                     emails_opened=excluded.emails_opened,
                     replies_received=excluded.replies_received,
                     hot_leads=excluded.hot_leads""",
                (report["date"], report["newLeads"], report["emailsSent"],
                 report["emailsOpened"], report["repliesReceived"], report["hotLeads"])
            )
            conn.commit()
    except Exception:
        pass
    return jsonify(report)


# ── Settings ───────────────────────────────────────────────────────────────────
@app.route("/api/settings")
def get_settings():
    try:
        s = db.get_all_settings()
        try:
            fud = [int(x) for x in s.get("follow_up_days", "3,7,14").split(",")]
        except Exception:
            fud = [3, 7, 14]
        key = s.get("anthropic_api_key", "")
        masked_key = ("••••••••" + key[-4:]) if key and len(key) > 8 else key
        return jsonify({
            "anthropicKey": masked_key,
            "senderEmail": s.get("sender_email", ""),
            "senderName": s.get("sender_name", ""),
            "followUpDays": fud,
            "maxEmailsPerDay": int(s.get("max_emails_per_day", "50")),
            "scrapeDelay": float(s.get("scrape_delay", "2")),
            "targetKeyword": s.get("target_keyword", "independent financial advisor"),
            "productName": s.get("product_name", "LeadStack"),
            "productUrl": s.get("product_url", ""),
            "calendlyUrl": s.get("calendly_url", ""),
            "senderSignature": s.get("sender_signature", ""),
            "appPassword": "••••••••••••••••" if s.get("gmail_app_password") else "",
            "googleMapsApiKey": ("••••••••" + s.get("google_maps_api_key", "")[-4:]) if s.get("google_maps_api_key") else "",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings", methods=["POST"])
def save_settings():
    try:
        data = request.json or {}
        mapping = {
            # camelCase keys (from SettingsSection)
            "anthropicKey": "anthropic_api_key",
            "senderEmail": "sender_email",
            "senderName": "sender_name",
            "maxEmailsPerDay": "max_emails_per_day",
            "scrapeDelay": "scrape_delay",
            "targetKeyword": "target_keyword",
            "productName": "product_name",
            "productUrl": "product_url",
            "calendlyUrl": "calendly_url",
            "senderSignature": "sender_signature",
            # snake_case keys (from OnboardingWizard)
            "anthropic_key": "anthropic_api_key",
            "sender_email": "sender_email",
            "sender_name": "sender_name",
            "app_password": "gmail_app_password",
            "appPassword": "gmail_app_password",
            "googleMapsApiKey": "google_maps_api_key",
            "google_maps_api_key": "google_maps_api_key",
        }
        for fk, dk in mapping.items():
            if fk in data:
                val = data[fk]
                if isinstance(val, str) and "••••" in val:
                    continue  # Don't overwrite masked key
                db.set_setting(dk, str(val))
        if "followUpDays" in data:
            db.set_setting("follow_up_days", ",".join(str(d) for d in data["followUpDays"]))
        # Reset singletons so they pick up new settings on next use
        global _email_writer
        with _writer_lock:
            _email_writer = None
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Gmail OAuth setup ──────────────────────────────────────────────────────────
@app.route("/api/gmail/auth", methods=["POST"])
def gmail_auth():
    """Trigger Gmail OAuth flow (opens browser on desktop)."""
    try:
        body = request.json or {}
        client_id = body.get("client_id", "")
        client_secret = body.get("client_secret", "")
        g = get_gmail(force_refresh=True)
        if g:
            ok = g.authenticate(client_id=client_id, client_secret=client_secret)
            return jsonify({"ok": ok, "email": getattr(g, "sender_email", "")})
        return jsonify({"ok": False, "error": "GmailEngine failed to init"}), 500
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/gmail/status")
def gmail_status():
    try:
        g = get_gmail()
        connected = g is not None and g.service is not None
        return jsonify({
            "connected": connected,
            "email": getattr(g, "sender_email", "") if g else "",
        })
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})


# ── AI Prospect Research ─────────────────────────────────────────────────────
@app.route("/api/research/prospect", methods=["POST"])
def research_prospect():
    """Research a prospect and generate a hyper-personalised first line."""
    data = request.json or {}
    lead_id = data.get("lead_id")
    lead = data.get("lead", {})

    if lead_id and not lead:
        lead = db.get_lead_by_id(lead_id)
        if not lead:
            return jsonify({"error": "Lead not found"}), 404

    api_key = db.get_setting("anthropic_api_key", "")
    if not api_key:
        return jsonify({"error": "Anthropic API key not set"}), 400

    try:
        from prospect_researcher import ProspectResearcher
        sender_name = db.get_setting("sender_name", "")
        researcher = ProspectResearcher(api_key=api_key, sender_name=sender_name)
        result = researcher.research_prospect(lead)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/research/batch", methods=["POST"])
def research_batch():
    """Research multiple prospects in sequence (rate-limited)."""
    data = request.json or {}
    lead_ids = data.get("lead_ids", [])
    if not lead_ids:
        return jsonify({"error": "No lead_ids provided"}), 400

    api_key = db.get_setting("anthropic_api_key", "")
    if not api_key:
        return jsonify({"error": "Anthropic API key not set"}), 400

    results = []
    try:
        from prospect_researcher import ProspectResearcher
        sender_name = db.get_setting("sender_name", "")
        researcher = ProspectResearcher(api_key=api_key, sender_name=sender_name)
        for lid in lead_ids[:20]:  # Cap at 20 per batch
            lead = db.get_lead_by_id(lid)
            if lead:
                result = researcher.research_prospect(lead)
                result["lead_id"] = lid
                results.append(result)
        return jsonify({"results": results, "count": len(results)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Warmup Engine ─────────────────────────────────────────────────────────────
_warmup = None
_warmup_lock = threading.Lock()

def get_warmup():
    global _warmup
    with _warmup_lock:
        if _warmup is None:
            from warmup_engine import WarmupEngine
            _warmup = WarmupEngine()
        return _warmup


@app.route("/api/warmup/accounts")
def warmup_accounts():
    return jsonify(get_warmup().get_accounts())


@app.route("/api/warmup/accounts", methods=["POST"])
def warmup_add_account():
    data = request.json or {}
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"error": "Email required"}), 400
    result = get_warmup().add_account(
        email=email,
        display_name=data.get("display_name", ""),
        is_primary=data.get("is_primary", False)
    )
    return jsonify(result)


@app.route("/api/warmup/accounts/<email>", methods=["DELETE"])
def warmup_remove_account(email):
    get_warmup().remove_account(email)
    return jsonify({"success": True})


@app.route("/api/warmup/accounts/<email>", methods=["PATCH"])
def warmup_update_account(email):
    data = request.json or {}
    get_warmup().update_account(email, data)
    return jsonify({"success": True})


@app.route("/api/warmup/simulate", methods=["POST"])
def warmup_simulate():
    result = get_warmup().simulate_warmup_activity()
    return jsonify(result)


@app.route("/api/warmup/schedule")
def warmup_schedule():
    return jsonify(get_warmup().get_warmup_schedule())


@app.route("/api/warmup/reputation")
def warmup_reputation():
    return jsonify(get_warmup().get_reputation_summary())


@app.route("/api/warmup/log")
def warmup_log():
    limit = int(request.args.get("limit", 50))
    return jsonify(get_warmup().get_warmup_log(limit))


@app.route("/api/warmup/rotation")
def warmup_rotation():
    return jsonify(get_warmup().get_rotation_accounts())


@app.route("/api/warmup/rotation", methods=["POST"])
def warmup_add_rotation():
    data = request.json or {}
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"error": "Email required"}), 400
    result = get_warmup().add_rotation_account(
        email=email,
        display_name=data.get("display_name", ""),
        daily_limit=int(data.get("daily_limit", 50))
    )
    return jsonify(result)


# ── Deliverability Checker ────────────────────────────────────────────────────
_deliverability = None

def get_deliverability():
    global _deliverability
    if _deliverability is None:
        from deliverability_checker import DeliverabilityChecker
        _deliverability = DeliverabilityChecker()
    return _deliverability


@app.route("/api/deliverability/check", methods=["POST"])
def deliverability_check():
    data = request.json or {}
    subject = data.get("subject", "")
    body = data.get("body", "")
    domain = data.get("domain", "")
    if not subject and not body:
        return jsonify({"error": "subject or body required"}), 400
    result = get_deliverability().full_pre_send_check(subject, body, domain)
    return jsonify(result)


@app.route("/api/deliverability/domain", methods=["POST"])
def deliverability_domain():
    data = request.json or {}
    domain = data.get("domain", "")
    if not domain:
        return jsonify({"error": "domain required"}), 400
    result = get_deliverability().check_domain(domain)
    return jsonify(result)


@app.route("/api/deliverability/content", methods=["POST"])
def deliverability_content():
    data = request.json or {}
    subject = data.get("subject", "")
    body = data.get("body", "")
    result = get_deliverability().check_email_content(subject, body)
    return jsonify(result)


# ── Deal Tracker ──────────────────────────────────────────────────────────────
_deal_tracker = None

def get_deal_tracker():
    global _deal_tracker
    if _deal_tracker is None:
        from deal_tracker import DealTracker
        _deal_tracker = DealTracker()
    return _deal_tracker


@app.route("/api/deals")
def deals_list():
    return jsonify(get_deal_tracker().get_all_deals())


@app.route("/api/deals/summary")
def deals_summary():
    return jsonify(get_deal_tracker().get_pipeline_summary())


@app.route("/api/deals", methods=["POST"])
def deals_create():
    data = request.json or {}
    lead_id = data.get("lead_id")
    if not lead_id:
        return jsonify({"error": "lead_id required"}), 400
    lead = db.get_lead_by_id(lead_id)
    company = lead.get("name", "") if lead else data.get("company", "")
    result = get_deal_tracker().upsert_deal(
        lead_id=lead_id,
        lead_name=data.get("lead_name", company),
        company=company,
        deal_value=float(data.get("deal_value", 0)),
        close_probability=data.get("close_probability"),
        expected_close=data.get("expected_close"),
        stage=data.get("stage", "Prospect"),
        notes=data.get("notes", ""),
    )
    return jsonify(result)


@app.route("/api/deals/<int:lead_id>", methods=["PATCH"])
def deals_update(lead_id):
    data = request.json or {}
    existing = get_deal_tracker().get_deal(lead_id)
    if not existing:
        return jsonify({"error": "Deal not found"}), 404
    lead = db.get_lead_by_id(lead_id)
    company = lead.get("name", "") if lead else existing.get("company", "")
    result = get_deal_tracker().upsert_deal(
        lead_id=lead_id,
        lead_name=data.get("lead_name", existing["lead_name"]),
        company=company,
        deal_value=float(data.get("deal_value", existing["deal_value"])),
        close_probability=data.get("close_probability", existing["close_probability"]),
        expected_close=data.get("expected_close", existing["expected_close"]),
        stage=data.get("stage", existing["stage"]),
        notes=data.get("notes", existing["notes"]),
    )
    return jsonify(result)


@app.route("/api/deals/<int:lead_id>", methods=["DELETE"])
def deals_delete(lead_id):
    get_deal_tracker().delete_deal(lead_id)
    return jsonify({"success": True})


# ── Daily Briefing ────────────────────────────────────────────────────────────
@app.route("/api/briefing")
def daily_briefing():
    """Generate the AI morning briefing."""
    api_key = db.get_setting("anthropic_api_key", "")
    if not api_key:
        return jsonify({"error": "Anthropic API key not set"}), 400

    try:
        # Gather pipeline data
        leads = db.get_leads()
        hot_leads = [l for l in leads if l.get("status") in ("Hot Lead", "Meeting Booked")]

        # Yesterday's stats
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")

        with db._connect() as conn:
            yesterday_stats = conn.execute(
                "SELECT * FROM daily_stats WHERE date=?", (yesterday,)
            ).fetchone()
            today_stats = conn.execute(
                "SELECT * FROM daily_stats WHERE date=?", (today,)
            ).fetchone()

        sent_yesterday = yesterday_stats["emails_sent"] if yesterday_stats else 0
        opened_yesterday = yesterday_stats["emails_opened"] if yesterday_stats else 0
        meetings = yesterday_stats["meetings_booked"] if yesterday_stats else 0
        new_leads_today = today_stats["leads_scraped"] if today_stats else 0

        # Recent replies
        with db._connect() as conn:
            recent_replies = conn.execute(
                """SELECT ec.reply_sentiment as intent, l.name as from_name
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.replied_at >= ?
                   ORDER BY ec.replied_at DESC LIMIT 10""",
                ((datetime.now() - timedelta(days=2)).isoformat(timespec="seconds"),)
            ).fetchall()
        recent_replies_list = [
            {"intent": r["intent"] or "unknown", "from": r["from_name"]}
            for r in recent_replies
        ]

        # Pipeline value from deal tracker
        try:
            summary = get_deal_tracker().get_pipeline_summary()
            pipeline_value = summary.get("weighted_pipeline", 0)
        except Exception:
            pipeline_value = len(hot_leads) * 5000  # rough estimate

        pipeline_data = {
            "leads": leads,
            "recent_replies": recent_replies_list,
            "emails_sent_yesterday": sent_yesterday,
            "emails_opened_yesterday": opened_yesterday,
            "meetings_booked": meetings,
            "pipeline_value": pipeline_value,
            "new_leads_today": new_leads_today,
        }

        from daily_briefing import DailyBriefingEngine
        sender_name = db.get_setting("sender_name", "")
        engine = DailyBriefingEngine(api_key=api_key, sender_name=sender_name)
        result = engine.generate_briefing(pipeline_data)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Adaptive Sequences ────────────────────────────────────────────────────────
@app.route("/api/sequences/adaptive", methods=["POST"])
def adaptive_sequences():
    """
    Trigger adaptive follow-up logic:
    - Opened but no reply → send shorter, more direct follow-up
    - No open → resend with different subject line
    - Replied interested → skip remaining sequence, flag as hot
    """
    data = request.json or {}
    dry_run = data.get("dry_run", True)

    writer = get_email_writer()
    if not writer:
        return jsonify({"error": "Anthropic API key not set"}), 400

    actions = []
    try:
        with db._connect() as conn:
            # Find emails sent 2+ days ago with no reply and no follow-up yet
            cutoff = (datetime.now() - timedelta(days=2)).isoformat(timespec="seconds")
            opened_no_reply = conn.execute(
                """SELECT ec.id, ec.lead_id, ec.subject, ec.opened_at, ec.sequence_step,
                          l.name, l.email, l.city, l.category
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.status = 'opened'
                     AND ec.opened_at <= ?
                     AND ec.sequence_step = 1
                     AND l.email != ''
                     AND ec.lead_id NOT IN (
                         SELECT lead_id FROM email_campaigns WHERE sequence_step >= 2
                     )
                   LIMIT 20""",
                (cutoff,)
            ).fetchall()

            no_open_no_reply = conn.execute(
                """SELECT ec.id, ec.lead_id, ec.subject, ec.sent_at, ec.sequence_step,
                          l.name, l.email, l.city, l.category
                   FROM email_campaigns ec
                   JOIN leads l ON ec.lead_id = l.id
                   WHERE ec.status = 'sent'
                     AND ec.opened_at IS NULL
                     AND ec.sent_at <= ?
                     AND ec.sequence_step = 1
                     AND l.email != ''
                     AND ec.lead_id NOT IN (
                         SELECT lead_id FROM email_campaigns WHERE sequence_step >= 2
                     )
                   LIMIT 20""",
                (cutoff,)
            ).fetchall()

        for row in opened_no_reply:
            actions.append({
                "type": "opened_no_reply",
                "lead_id": row["lead_id"],
                "lead_name": row["name"],
                "email": row["email"],
                "original_subject": row["subject"],
                "action": "Send shorter, more direct follow-up referencing they opened",
                "next_step": 2,
            })

        for row in no_open_no_reply:
            actions.append({
                "type": "no_open",
                "lead_id": row["lead_id"],
                "lead_name": row["name"],
                "email": row["email"],
                "original_subject": row["subject"],
                "action": "Resend with shorter subject line + different angle",
                "next_step": 2,
            })

        return jsonify({
            "actions": actions,
            "total": len(actions),
            "dry_run": dry_run,
            "message": f"Found {len(actions)} leads needing adaptive follow-up"
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── Calendly / Booking Link Injection ────────────────────────────────────────
@app.route("/api/email/inject-booking", methods=["POST"])
def inject_booking_link():
    """Inject a Calendly/booking link into an email reply draft."""
    data = request.json or {}
    reply_text = data.get("reply_text") or data.get("body", "")
    booking_url = data.get("booking_url", "") or db.get_setting("calendly_url", "")

    if not booking_url:
        return jsonify({"error": "No booking URL configured. Add it in Settings."}), 400

    if not reply_text:
        return jsonify({"error": "reply_text required"}), 400

    # Inject booking link naturally
    booking_line = f"\n\nYou can grab a time that works for you here: {booking_url}"

    # Insert before the sign-off if possible
    signoffs = ["\nBest,", "\nThanks,", "\nCheers,", "\nRegards,", "\nSpeak soon,"]
    injected = False
    for signoff in signoffs:
        if signoff in reply_text:
            reply_text = reply_text.replace(signoff, booking_line + signoff, 1)
            injected = True
            break

    if not injected:
        reply_text = reply_text.rstrip() + booking_line

    return jsonify({
        "body": reply_text,
        "reply_text": reply_text,
        "booking_url": booking_url,
        "injected": True
    })


# ── Serve React SPA ───────────────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve the React SPA. API routes are handled by their own handlers."""
    # Never intercept /api/* — those are handled by dedicated route handlers
    if path.startswith('api') or path.startswith('api/'):
        from flask import abort
        abort(404)
    # Serve static assets (JS, CSS, images) from the dist folder
    if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
        return send_from_directory(FRONTEND_DIST, path)
    # All other routes → return index.html (React SPA client-side routing)
    index = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.exists(index):
        return send_file(index)
    return jsonify({'error': 'Frontend not built. Run: cd frontend && npm run build'}), 503


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("LEADSTACK_PORT", 7432))
    print(f"\n{'='*55}")
    print(f"  LeadStack™ Backend v16.0 — All systems go")
    print(f"  http://127.0.0.1:{port}")
    print(f"{'='*55}\n")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)

# ── LinkedIn Scraper Routes ───────────────────────────────────────────────────
@app.route("/api/linkedin/session")
def linkedin_session():
    try:
        from linkedin_scraper import check_linkedin_session
        return jsonify(check_linkedin_session())
    except Exception as e:
        return jsonify({"logged_in": False, "reason": str(e)})

@app.route("/api/linkedin/login", methods=["POST"])
def linkedin_login():
    try:
        import threading
        def _open():
            from linkedin_scraper import open_linkedin_login_browser
            open_linkedin_login_browser()
        threading.Thread(target=_open, daemon=True).start()
        return jsonify({"started": True, "message": "Browser opened — log in to LinkedIn"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/linkedin/scrape", methods=["POST"])
def linkedin_scrape():
    data = request.json or {}
    keyword = data.get("keyword", "")
    location = data.get("location", "")
    max_results = int(data.get("max_results", 25))
    filters = data.get("filters", {})
    if not keyword:
        return jsonify({"error": "keyword required"}), 400
    try:
        from linkedin_scraper import scrape_linkedin_leads
        leads = scrape_linkedin_leads(keyword, location, max_results, filters)
        if leads and leads[0].get("error"):
            return jsonify(leads[0]), 400
        return jsonify({"leads": leads, "count": len(leads)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/linkedin/save", methods=["POST"])
def linkedin_save():
    data = request.json or {}
    leads = data.get("leads", [])
    try:
        from linkedin_scraper import save_linkedin_leads_to_db
        result = save_linkedin_leads_to_db(leads)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Unsubscribe Routes ────────────────────────────────────────────────────────
@app.route("/unsubscribe")
def unsubscribe_page():
    token = request.args.get("token", "")
    if not token:
        return "<h2>Invalid unsubscribe link</h2>", 400
    try:
        from unsubscribe_handler import process_unsubscribe, ensure_unsubscribe_tables
        ensure_unsubscribe_tables()
        result = process_unsubscribe(token)
        if result.get("success"):
            return f"""<!DOCTYPE html><html><head><title>Unsubscribed</title>
<style>body{{font-family:system-ui;background:#0a0a14;color:#e8e4d8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}}
.box{{text-align:center;padding:40px;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,0.1);}}</style>
</head><body><div class="box"><h2>&#10003; Unsubscribed</h2><p>You have been removed from our mailing list.</p></div></body></html>"""
        else:
            return f"<h2>Error: {result.get('error','Unknown error')}</h2>", 400
    except Exception as e:
        return f"<h2>Error: {e}</h2>", 500

@app.route("/api/unsubscribe/list")
def unsubscribe_list():
    try:
        from unsubscribe_handler import get_unsubscribe_list
        return jsonify({"unsubscribed": get_unsubscribe_list()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Gmail OAuth Routes ────────────────────────────────────────────────────────
@app.route("/api/gmail/oauth/status")
def gmail_oauth_status():
    try:
        from gmail_oauth import check_oauth_configured, list_connected_accounts
        config = check_oauth_configured()
        accounts = list_connected_accounts()
        return jsonify({**config, "connected_accounts": accounts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/gmail/oauth/start", methods=["POST"])
def gmail_oauth_start():
    try:
        from gmail_oauth import start_oauth_flow
        return jsonify(start_oauth_flow())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/gmail/accounts")
def gmail_accounts():
    try:
        from gmail_oauth import list_connected_accounts
        return jsonify({"accounts": list_connected_accounts()})
    except Exception as e:
        return jsonify({"accounts": [], "error": str(e)})

@app.route("/api/gmail/accounts/<email>", methods=["DELETE"])
def gmail_remove_account(email):
    try:
        from gmail_oauth import remove_account
        remove_account(email)
        return jsonify({"removed": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Test/Onboarding Routes ────────────────────────────────────────────────────
@app.route("/api/test-ai", methods=["POST"])
def test_ai():
    data = request.json or {}
    api_key = data.get("api_key", "")
    if not api_key or not api_key.startswith("sk-ant-"):
        return jsonify({"error": "invalid_key"}), 400
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "Say OK"}]
        )
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/test-gmail", methods=["POST"])
def test_gmail():
    data = request.json or {}
    email = data.get("email", "")
    password = data.get("app_password", "")
    if not email or not password:
        return jsonify({"error": "email and app_password required"}), 400
    try:
        import smtplib
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(email, password)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ── Real Warmup Engine Routes ─────────────────────────────────────────────────
@app.route("/api/warmup/start-real", methods=["POST"])
def warmup_start_real():
    try:
        from warmup_real import start_warmup_scheduler
        return jsonify(start_warmup_scheduler())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/warmup/stop-real", methods=["POST"])
def warmup_stop_real():
    try:
        from warmup_real import stop_warmup_scheduler
        return jsonify(stop_warmup_scheduler())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/warmup/run-cycle", methods=["POST"])
def warmup_run_cycle():
    try:
        from warmup_real import run_warmup_cycle
        result = run_warmup_cycle()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

