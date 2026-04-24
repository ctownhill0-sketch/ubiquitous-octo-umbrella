"""
LeadStack™ Backend Server
Flask API that bridges the Electron frontend to the Python engines.
"""
import os
import sys
import json
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add backend dir to path
sys.path.insert(0, os.path.dirname(__file__))

from database import Database
from scraper import GoogleMapsScraper
from email_writer import EmailWriter
from automation import AutomationEngine

app = Flask(__name__)
CORS(app)

# ─── Singletons ───────────────────────────────────────────────────────────────
db = Database()
scraper = GoogleMapsScraper()
email_writer = EmailWriter()
automation = AutomationEngine()

# Active scrape job state
scrape_state = {
    "running": False,
    "progress": 0,
    "total": 0,
    "current_city": "",
    "leads_found": 0,
    "log": [],
}

# ─── Health ───────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})

# ─── Stats ────────────────────────────────────────────────────────────────────
@app.route('/api/stats')
def stats():
    leads = db.get_leads()
    total = len(leads)
    with_email = sum(1 for l in leads if l.get('email'))
    with_phone = sum(1 for l in leads if l.get('phone'))
    hot = sum(1 for l in leads if l.get('status') == 'Hot Lead')
    emails_sent = db.get_emails_sent_count()
    replies = db.get_replies_count()
    meetings = sum(1 for l in leads if l.get('status') == 'Meeting Booked')
    pipeline = meetings * 299 * 12  # estimated ARR per meeting
    return jsonify({
        "total_leads": total,
        "with_email": with_email,
        "with_phone": with_phone,
        "hot_leads": hot,
        "emails_sent": emails_sent,
        "replies": replies,
        "meetings": meetings,
        "pipeline_value": pipeline,
        "open_rate": 35,
    })

# ─── Leads ────────────────────────────────────────────────────────────────────
@app.route('/api/leads')
def get_leads():
    filters = {}
    if request.args.get('status'):
        filters['status'] = request.args.get('status')
    if request.args.get('has_email') == 'true':
        filters['has_email'] = True
    if request.args.get('has_phone') == 'true':
        filters['has_phone'] = True
    leads = db.get_leads(filters)
    return jsonify(leads)

@app.route('/api/leads/<int:lead_id>', methods=['PATCH'])
def update_lead(lead_id):
    data = request.json
    db.update_lead(lead_id, data)
    return jsonify({"success": True})

@app.route('/api/leads/export/csv')
def export_csv():
    import csv, io
    leads = db.get_leads()
    output = io.StringIO()
    if leads:
        writer = csv.DictWriter(output, fieldnames=leads[0].keys())
        writer.writeheader()
        writer.writerows(leads)
    return app.response_class(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=leadstack_leads.csv'}
    )

# ─── Scraper ──────────────────────────────────────────────────────────────────
@app.route('/api/scraper/start', methods=['POST'])
def start_scrape():
    global scrape_state
    if scrape_state["running"]:
        return jsonify({"error": "Scrape already running"}), 400

    body = request.json or {}
    keyword = body.get("keyword", "independent financial advisor")
    city = body.get("city", "New York, NY")
    max_results = int(body.get("max_results", 20))

    def run_scrape():
        global scrape_state
        scrape_state.update({"running": True, "progress": 0, "leads_found": 0,
                              "current_city": city, "log": []})
        try:
            def progress_cb(current, total, lead=None):
                scrape_state["progress"] = current
                scrape_state["total"] = total
                if lead:
                    scrape_state["leads_found"] += 1
                    scrape_state["log"].append(f"Found: {lead.get('name', 'Unknown')}")
                    db.save_lead(lead)

            leads = scraper.search(keyword, city, max_results=max_results,
                                   progress_callback=progress_cb)
            scrape_state["log"].append(f"✓ Completed — {len(leads)} leads found")
        except Exception as e:
            scrape_state["log"].append(f"✗ Error: {str(e)}")
        finally:
            scrape_state["running"] = False

    threading.Thread(target=run_scrape, daemon=True).start()
    return jsonify({"started": True})

@app.route('/api/scraper/status')
def scrape_status():
    return jsonify(scrape_state)

@app.route('/api/scraper/stop', methods=['POST'])
def stop_scrape():
    global scrape_state
    scrape_state["running"] = False
    return jsonify({"stopped": True})

# ─── Email ────────────────────────────────────────────────────────────────────
@app.route('/api/email/send', methods=['POST'])
def send_emails():
    body = request.json or {}
    limit = int(body.get("limit", 40))

    def run_send():
        try:
            automation.run_email_engine(limit=limit)
        except Exception as e:
            print(f"Email engine error: {e}")

    threading.Thread(target=run_send, daemon=True).start()
    return jsonify({"started": True})

@app.route('/api/email/preview', methods=['POST'])
def preview_email():
    body = request.json or {}
    lead = body.get("lead", {})
    try:
        subject, email_body = email_writer.write_cold_email(lead)
        return jsonify({"subject": subject, "body": email_body})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Settings ─────────────────────────────────────────────────────────────────
@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = db.get_settings()
    # Never return secrets in plaintext — mask them
    if settings.get('claude_api_key'):
        settings['claude_api_key'] = '••••••••' + settings['claude_api_key'][-4:]
    return jsonify(settings)

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json or {}
    db.save_settings(data)
    return jsonify({"saved": True})

# ─── Automation ───────────────────────────────────────────────────────────────
@app.route('/api/machine/start', methods=['POST'])
def start_machine():
    try:
        automation.start()
        return jsonify({"running": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/machine/stop', methods=['POST'])
def stop_machine():
    try:
        automation.stop()
        return jsonify({"running": False})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/machine/status')
def machine_status():
    return jsonify({"running": automation.is_running()})

# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 7432))
    print(f"LeadStack™ backend starting on port {port}")
    app.run(host='127.0.0.1', port=port, debug=False, threaded=True)
