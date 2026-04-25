"""
daily_briefing.py — AI Daily Briefing Engine
Every morning, Claude reads your pipeline and tells you exactly
who to call, who's hot, and what happened overnight.
"""

import json
import re
import urllib.request
from datetime import datetime, timedelta
from typing import Optional


class DailyBriefingEngine:
    def __init__(self, api_key: str, sender_name: str = ""):
        self.api_key = api_key
        self.sender_name = sender_name

    def generate_briefing(self, pipeline_data: dict) -> dict:
        """
        Generate a personalised daily briefing from pipeline data.

        pipeline_data should contain:
        - leads: list of leads with status, score, last_contact
        - recent_replies: list of recent replies with intent
        - emails_sent_yesterday: int
        - emails_opened_yesterday: int
        - meetings_booked: int
        - pipeline_value: float
        """
        now = datetime.now()
        greeting_time = "morning" if now.hour < 12 else ("afternoon" if now.hour < 17 else "evening")
        day_name = now.strftime("%A")
        date_str = now.strftime("%B %d")

        leads = pipeline_data.get("leads", [])
        replies = pipeline_data.get("recent_replies", [])
        sent_yesterday = pipeline_data.get("emails_sent_yesterday", 0)
        opened_yesterday = pipeline_data.get("emails_opened_yesterday", 0)
        meetings = pipeline_data.get("meetings_booked", 0)
        pipeline_value = pipeline_data.get("pipeline_value", 0)
        new_leads = pipeline_data.get("new_leads_today", 0)

        # Identify hot leads (interested replies or high score)
        hot_leads = [l for l in leads if l.get("status") in ("Hot Lead", "Meeting Booked")]
        interested_replies = [r for r in replies if r.get("intent") == "interested"]
        question_replies = [r for r in replies if r.get("intent") == "question"]
        not_now_replies = [r for r in replies if r.get("intent") == "not_now"]

        # Build context for Claude
        context = f"""
Today is {day_name}, {date_str}. Good {greeting_time}!

PIPELINE SNAPSHOT:
- Total leads in CRM: {len(leads)}
- Hot leads (interested/meeting booked): {len(hot_leads)}
- New leads scraped today: {new_leads}
- Estimated pipeline value: ${pipeline_value:,.0f}

YESTERDAY'S ACTIVITY:
- Emails sent: {sent_yesterday}
- Emails opened: {opened_yesterday} ({round(opened_yesterday/max(sent_yesterday,1)*100)}% open rate)
- Meetings booked: {meetings}

RECENT REPLIES NEEDING ATTENTION:
- Interested replies: {len(interested_replies)} — {', '.join(r.get('from','?') for r in interested_replies[:3])}
- Questions to answer: {len(question_replies)} — {', '.join(r.get('from','?') for r in question_replies[:3])}
- Not now (follow up in 90 days): {len(not_now_replies)}

HOT LEADS TO PRIORITISE:
{chr(10).join(f"- {l.get('name','?')} ({l.get('status','?')}, score: {l.get('lead_score',0)})" for l in hot_leads[:5]) or '- None yet'}
"""

        prompt = f"""{context}

You are a sharp sales coach giving a morning briefing to a solo founder running outbound sales.
Be direct, specific, and actionable. No fluff. Maximum 200 words total.

Write a briefing with these exact sections:
1. ONE sentence summary of where things stand
2. "TODAY'S PRIORITIES" — 3 specific actions with names/numbers
3. "WATCH OUT FOR" — 1-2 risks or things to not let slip
4. ONE motivating closer sentence

Keep it punchy. Use actual names and numbers from the data. Sound like a trusted advisor, not a bot."""

        try:
            payload = json.dumps({
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}]
            }).encode()

            request = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=payload,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                method="POST"
            )
            with urllib.request.urlopen(request, timeout=25) as resp:
                data = json.loads(resp.read())
                briefing_text = data["content"][0]["text"].strip()

                return {
                    "success": True,
                    "briefing": briefing_text,
                    "generated_at": datetime.now().isoformat(timespec="seconds"),
                    "stats": {
                        "hot_leads": len(hot_leads),
                        "interested_replies": len(interested_replies),
                        "emails_sent_yesterday": sent_yesterday,
                        "open_rate": round(opened_yesterday / max(sent_yesterday, 1) * 100),
                        "pipeline_value": pipeline_value,
                        "meetings_booked": meetings,
                    }
                }
        except Exception as e:
            # Fallback briefing
            briefing = self._fallback_briefing(
                day_name, date_str, greeting_time,
                hot_leads, interested_replies, sent_yesterday,
                opened_yesterday, meetings, pipeline_value
            )
            return {
                "success": False,
                "briefing": briefing,
                "generated_at": datetime.now().isoformat(timespec="seconds"),
                "stats": {
                    "hot_leads": len(hot_leads),
                    "interested_replies": len(interested_replies),
                    "emails_sent_yesterday": sent_yesterday,
                    "open_rate": round(opened_yesterday / max(sent_yesterday, 1) * 100),
                    "pipeline_value": pipeline_value,
                    "meetings_booked": meetings,
                }
            }

    def _fallback_briefing(self, day_name, date_str, greeting_time,
                            hot_leads, interested_replies, sent_yesterday,
                            opened_yesterday, meetings, pipeline_value) -> str:
        open_rate = round(opened_yesterday / max(sent_yesterday, 1) * 100)
        lines = [
            f"Good {greeting_time} — here's your {day_name} snapshot.",
            "",
            "TODAY'S PRIORITIES:",
        ]

        if interested_replies:
            names = ", ".join((r.get("from", "?").split() or ["?"])[0] for r in interested_replies[:2])
            lines.append(f"  1. Reply to {names} — they're interested, don't let them go cold.")
        else:
            lines.append("  1. Send today's batch of cold emails — keep the pipeline moving.")

        if hot_leads:
            top = hot_leads[0].get("name", "your top lead")
            lines.append(f"  2. Follow up with {top} — they're in your hot leads.")
        else:
            lines.append("  2. Scrape 50 fresh leads and queue them for outreach.")

        lines.append(f"  3. Review yesterday's {sent_yesterday} sends — {open_rate}% open rate.")
        lines.append("")
        lines.append("WATCH OUT FOR:")

        if open_rate < 20:
            lines.append("  - Open rate is below 20% — test a new subject line today.")
        else:
            lines.append("  - Don't let interested replies sit more than 24 hours.")

        lines.append("")
        if pipeline_value > 0:
            lines.append(f"${pipeline_value:,.0f} in pipeline. Keep pushing.")
        else:
            lines.append("Every email sent today is an investment. Make them count.")

        return "\n".join(lines)
