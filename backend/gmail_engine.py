"""
gmail_engine.py — Gmail OAuth2 sender, follow-up engine, and reply monitor.
Uses Google Gmail API with OAuth2 for secure sending and inbox monitoring.
"""

import os
import base64
import json
import time
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

TOKEN_FILE  = os.path.join(os.path.dirname(__file__), "gmail_token.json")
CREDS_FILE  = os.path.join(os.path.dirname(__file__), "gmail_credentials.json")


# ── Embedded OAuth credentials template ──────────────────────────────────────
# Users paste their own Google Cloud OAuth client_id/client_secret in Settings.
# We write it to gmail_credentials.json at runtime.

def write_credentials_file(client_id: str, client_secret: str):
    """Write Google OAuth credentials to file."""
    creds_data = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    with open(CREDS_FILE, "w") as f:
        json.dump(creds_data, f)


class GmailEngine:
    def __init__(self, on_log=None, on_reply_detected=None):
        self.service = None
        self.sender_email = ""
        self.on_log = on_log or (lambda msg, level="info": None)
        self.on_reply_detected = on_reply_detected or (lambda lead_id, sentiment: None)
        self._daily_send_count = 0
        self._last_send_date = ""
        self._send_lock = threading.Lock()

    # ── Authentication ────────────────────────────────────────────────────────

    def authenticate(self, client_id: str = "", client_secret: str = "") -> bool:
        """Authenticate with Gmail API. Returns True on success."""
        try:
            creds = None

            # Load existing token
            if os.path.exists(TOKEN_FILE):
                creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

            # Refresh or re-authenticate
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    if not os.path.exists(CREDS_FILE):
                        if client_id and client_secret:
                            write_credentials_file(client_id, client_secret)
                        else:
                            self.on_log("Gmail credentials not configured.", "error")
                            return False
                    flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
                    creds = flow.run_local_server(port=0)

                # Save token atomically — write to a temp file in the same
                # directory and rename. A crash mid-write would otherwise
                # leave a half-written token.json that breaks future logins.
                tmp = TOKEN_FILE + ".tmp"
                with open(tmp, "w") as f:
                    f.write(creds.to_json())
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, TOKEN_FILE)

            self.service = build("gmail", "v1", credentials=creds)

            # Get sender email
            profile = self.service.users().getProfile(userId="me").execute()
            self.sender_email = profile.get("emailAddress", "")
            self.on_log(f"Gmail connected: {self.sender_email}", "success")
            return True

        except Exception as e:
            self.on_log(f"Gmail auth failed: {e}", "error")
            return False

    def is_connected(self) -> bool:
        return self.service is not None

    def disconnect(self):
        self.service = None
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)

    # ── Sending ───────────────────────────────────────────────────────────────

    def _reset_daily_count(self):
        today = datetime.now().strftime("%Y-%m-%d")
        if today != self._last_send_date:
            self._daily_send_count = 0
            self._last_send_date = today

    def send_email(self, to: str, subject: str, body: str,
                   reply_to_thread_id: str = None,
                   daily_limit: int = 50) -> dict:
        """
        Send an email via Gmail API.
        Returns {"success": bool, "message_id": str, "thread_id": str, "error": str}
        """
        if not self.service:
            return {"success": False, "error": "Gmail not connected"}

        with self._send_lock:
            self._reset_daily_count()
            if self._daily_send_count >= daily_limit:
                return {"success": False, "error": f"Daily limit of {daily_limit} reached"}

        try:
            msg = MIMEMultipart("alternative")
            msg["To"]      = to
            msg["From"]    = self.sender_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            payload = {"raw": raw}
            if reply_to_thread_id:
                payload["threadId"] = reply_to_thread_id

            result = self.service.users().messages().send(
                userId="me", body=payload
            ).execute()

            with self._send_lock:
                self._daily_send_count += 1

            return {
                "success": True,
                "message_id": result.get("id", ""),
                "thread_id": result.get("threadId", ""),
                "error": ""
            }

        except HttpError as e:
            return {"success": False, "error": str(e), "message_id": "", "thread_id": ""}
        except Exception as e:
            return {"success": False, "error": str(e), "message_id": "", "thread_id": ""}

    def get_daily_send_count(self) -> int:
        self._reset_daily_count()
        return self._daily_send_count

    # ── Reply Monitoring ──────────────────────────────────────────────────────

    def check_thread_for_reply(self, thread_id: str,
                                original_message_id: str) -> dict:
        """
        Check if a Gmail thread has received a reply after our sent message.
        Returns {"has_reply": bool, "reply_text": str}
        """
        if not self.service or not thread_id:
            return {"has_reply": False, "reply_text": ""}
        try:
            thread = self.service.users().threads().get(
                userId="me", id=thread_id, format="full"
            ).execute()
            messages = thread.get("messages", [])
            # Look for messages that are not from us (i.e., replies)
            for msg in messages:
                if msg.get("id") == original_message_id:
                    continue
                headers = {h["name"]: h["value"]
                           for h in msg.get("payload", {}).get("headers", [])}
                from_addr = headers.get("From", "")
                if self.sender_email.lower() not in from_addr.lower():
                    # Extract plain text body
                    body = self._extract_body(msg)
                    return {"has_reply": True, "reply_text": body}
            return {"has_reply": False, "reply_text": ""}
        except Exception:
            return {"has_reply": False, "reply_text": ""}

    def _extract_body(self, message: dict) -> str:
        """Extract plain text body from a Gmail message."""
        try:
            payload = message.get("payload", {})
            if payload.get("mimeType") == "text/plain":
                data = payload.get("body", {}).get("data", "")
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            parts = payload.get("parts", [])
            for part in parts:
                if part.get("mimeType") == "text/plain":
                    data = part.get("body", {}).get("data", "")
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        except Exception:
            pass
        return ""

    # ── Batch Operations ──────────────────────────────────────────────────────

    def send_batch(self, emails: list, db, email_writer,
                   daily_limit: int = 50,
                   delay_seconds: int = 30,
                   on_progress=None,
                   use_ai: bool = True,
                   templates: dict = None) -> dict:
        """
        Send a batch of emails with throttling.
        emails: list of lead dicts with email addresses
        Returns summary dict.
        """
        sent = 0
        failed = 0
        skipped = 0
        templates = templates or {}

        for i, lead in enumerate(emails):
            if not lead.get("email"):
                skipped += 1
                continue

            self._reset_daily_count()
            if self._daily_send_count >= daily_limit:
                self.on_log(f"Daily limit ({daily_limit}) reached. Stopping.", "warning")
                break

            try:
                subject, body = email_writer.generate_email(
                    lead, step=1, use_ai=use_ai,
                    step1_subject_tpl=templates.get("step1_subject"),
                    step1_body_tpl=templates.get("step1_body"),
                )

                result = self.send_email(lead["email"], subject, body,
                                         daily_limit=daily_limit)

                if result["success"]:
                    # Record in DB
                    email_id = db.create_email(
                        lead_id=lead["id"],
                        email_address=lead["email"],
                        subject=subject,
                        body=body,
                        sequence_step=1,
                    )
                    db.mark_email_sent(email_id, result["message_id"], result["thread_id"])
                    db.update_lead_status(lead["id"], "Emailed")
                    sent += 1
                    self.on_log(f"Sent to {lead.get('name','?')} <{lead['email']}>", "success")
                else:
                    failed += 1
                    self.on_log(f"Failed: {lead.get('name','?')} — {result['error']}", "error")

            except Exception as e:
                failed += 1
                self.on_log(f"Error sending to {lead.get('name','?')}: {e}", "error")

            if on_progress:
                on_progress(i + 1, len(emails), sent, failed)

            # Throttle between sends
            if i < len(emails) - 1:
                time.sleep(delay_seconds)

        return {"sent": sent, "failed": failed, "skipped": skipped}

    def process_followups(self, db, email_writer,
                          daily_limit: int = 50,
                          delay_seconds: int = 30,
                          templates: dict = None) -> dict:
        """
        Process all pending follow-up emails (step 2 and step 3).
        """
        followups = db.get_emails_needing_followup()
        sent = 0
        templates = templates or {}

        for item in followups:
            self._reset_daily_count()
            if self._daily_send_count >= daily_limit:
                break

            step = item.get("step", 2)
            lead = {
                "id": item["lead_id"],
                "name": item["name"],
                "city": item["city"],
                "category": item.get("lead_category", ""),
                "rating": item.get("lead_rating", ""),
                "reviews_count": item.get("lead_reviews_count", ""),
                "email": item["email"],
                "phone": item.get("lead_phone", ""),
            }

            subject, body = email_writer.generate_email(
                lead, step=step, use_ai=False,
                step2_subject_tpl=templates.get("step2_subject"),
                step2_body_tpl=templates.get("step2_body"),
                step3_subject_tpl=templates.get("step3_subject"),
                step3_body_tpl=templates.get("step3_body"),
            )

            result = self.send_email(
                lead["email"], subject, body,
                reply_to_thread_id=item.get("gmail_thread_id"),
                daily_limit=daily_limit
            )

            if result["success"]:
                email_id = db.create_email(
                    lead_id=lead["id"],
                    email_address=lead["email"],
                    subject=subject,
                    body=body,
                    sequence_step=step,
                )
                db.mark_email_sent(email_id, result["message_id"], result["thread_id"])
                status = "Follow-Up Sent" if step == 2 else "Emailed"
                db.update_lead_status(lead["id"], status)
                sent += 1
                self.on_log(f"Follow-up (step {step}) sent to {lead['name']}", "success")

            time.sleep(delay_seconds)

        return {"sent": sent}

    def check_replies(self, db, email_writer) -> list:
        """
        Check all sent emails for replies. Update DB and fire callbacks.
        Returns list of hot leads detected.
        """
        hot_leads = []
        emails = db.get_sent_emails_for_reply_check()

        for email in emails:
            result = self.check_thread_for_reply(
                email.get("gmail_thread_id", ""),
                email.get("gmail_message_id", "")
            )
            if result["has_reply"]:
                sentiment = email_writer.analyse_reply_sentiment(result["reply_text"])
                db.mark_email_replied(email["id"], sentiment)

                if sentiment == "positive":
                    db.update_lead_status(email["lead_id"], "Hot Lead")
                    hot_leads.append({
                        "lead_id": email["lead_id"],
                        "name": email.get("name", ""),
                        "city": email.get("city", ""),
                        "sentiment": sentiment,
                    })
                    self.on_log(
                        f"🔥 HOT LEAD: {email.get('name','?')} replied positively!", "hot"
                    )
                    self.on_reply_detected(email["lead_id"], sentiment)

                elif sentiment == "unsubscribe":
                    db.update_lead_status(email["lead_id"], "Unsubscribed")
                    self.on_log(f"Unsubscribed: {email.get('name','?')}", "warning")

        return hot_leads
