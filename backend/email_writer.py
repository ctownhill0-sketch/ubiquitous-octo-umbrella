"""
email_writer.py — AI-powered cold email writer using Claude API.
Generates personalised cold emails for B2B outreach.
Universal — works for any product/service, not product-specific.
"""

import anthropic
import re


# ── Default Email Templates (editable in the UI) ─────────────────────────────

DEFAULT_STEP1_SUBJECT = "Quick question for {name}"

DEFAULT_STEP1_BODY = """\
Hi {first_name},

I came across {name} in {city} and wanted to reach out.

I'll be brief: I built {product_name} to help businesses like yours. I think it could genuinely make a difference for {name} and I'd love to show you why.

Would a quick 10-minute call this week work for you?

Best,
{sender_name}
{sender_title}
{sender_phone}
"""

DEFAULT_STEP2_SUBJECT = "Re: Quick question for {name}"

DEFAULT_STEP2_BODY = """\
Hi {first_name},

Just following up on my previous email about {product_name}.

I know you're busy — I'll keep this short. A lot of businesses in {city} are getting real results with {product_name} and I think {name} could too.

Worth a 10-minute call?

Best,
{sender_name}
{sender_phone}
"""

DEFAULT_STEP3_SUBJECT = "Closing the loop — {name}"

DEFAULT_STEP3_BODY = """\
Hi {first_name},

I've reached out a couple of times — I'll leave it here.

If {name} ever needs {product_name}, you know where to find us: {product_url}

Wishing you continued success.

{sender_name}
"""


# ── AI Email Generator ────────────────────────────────────────────────────────

class EmailWriter:
    def __init__(self, api_key: str, sender_name: str = "Your Name",
                 sender_title: str = "Founder",
                 sender_phone: str = "",
                 product_name: str = "LeadStack",
                 product_url: str = ""):
        self.api_key      = api_key  # stored so server.py can detect key changes
        self.client       = anthropic.Anthropic(api_key=api_key)
        self.sender_name  = sender_name
        self.sender_title = sender_title
        self.sender_phone = sender_phone
        self.product_name = product_name
        self.product_url  = product_url

    def _first_name(self, business_name: str) -> str:
        """Extract a plausible first name or return 'there'."""
        # If business name contains a person's name pattern, use it
        # Otherwise default to generic greeting
        words = business_name.split()
        common_words = {"financial","advisors","advisor","wealth","management",
                        "investment","capital","group","partners","associates",
                        "services","solutions","consulting","llc","inc","ltd",
                        "co","&","and","the"}
        for word in words:
            clean = re.sub(r"[^a-zA-Z]", "", word)
            if clean.lower() not in common_words and len(clean) > 2 and clean[0].isupper():
                return clean
        return "there"

    def generate_email(self, lead: dict, step: int = 1,
                       use_ai: bool = True,
                       step1_subject_tpl: str = None,
                       step1_body_tpl: str = None,
                       step2_subject_tpl: str = None,
                       step2_body_tpl: str = None,
                       step3_subject_tpl: str = None,
                       step3_body_tpl: str = None) -> tuple[str, str]:
        """
        Generate a personalised email for a lead.
        Returns (subject, body) tuple.
        """
        name     = lead.get("name") or "your firm"
        city     = lead.get("city") or lead.get("address", "").split(",")[-1].strip() or "your city"
        category = lead.get("category") or "financial advisory firm"
        rating   = lead.get("rating") or "highly rated"
        reviews  = lead.get("reviews_count") or "many"
        first    = self._first_name(name)

        fmt = dict(
            name=name, city=city, category=category,
            rating=rating, reviews=reviews, first_name=first,
            sender_name=self.sender_name,
            sender_title=self.sender_title,
            sender_phone=self.sender_phone,
            product_name=self.product_name,
            product_url=self.product_url,
        )

        # Select templates
        if step == 1:
            subj_tpl = step1_subject_tpl or DEFAULT_STEP1_SUBJECT
            body_tpl = step1_body_tpl    or DEFAULT_STEP1_BODY
        elif step == 2:
            subj_tpl = step2_subject_tpl or DEFAULT_STEP2_SUBJECT
            body_tpl = step2_body_tpl    or DEFAULT_STEP2_BODY
        else:
            subj_tpl = step3_subject_tpl or DEFAULT_STEP3_SUBJECT
            body_tpl = step3_body_tpl    or DEFAULT_STEP3_BODY

        subject = subj_tpl.format(**fmt)

        if use_ai and step == 1:
            body = self._ai_personalise(body_tpl.format(**fmt), lead, fmt)
        else:
            body = body_tpl.format(**fmt)

        return subject, body

    def _ai_personalise(self, base_email: str, lead: dict, fmt: dict) -> str:
        """Use Claude to lightly personalise the email — keep it natural."""
        try:
            prompt = f"""You are a sales copywriter. Lightly personalise this cold email to make it feel more human and specific to this business. Keep it under 150 words. Do NOT add fake details. Do NOT change the core message or offer. Return ONLY the email body, no subject line, no commentary.

Business: {fmt['name']}
City: {fmt['city']}
Category: {fmt['category']}
Rating: {fmt['rating']} stars, {fmt['reviews']} reviews

Base email:
{base_email}

Return the personalised email body only:"""

            message = self.client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )
            if message.content and getattr(message.content[0], "text", None):
                return message.content[0].text.strip()
            return base_email
        except Exception as e:
            # Fallback to template if AI fails
            print(f"[EmailWriter] enhance error: {e}")
            return base_email

    def analyse_reply_sentiment(self, reply_text: str) -> str:
        """
        Analyse a reply email to determine if it's positive, negative, or neutral.
        Returns: 'positive', 'negative', 'unsubscribe', or 'neutral'
        """
        try:
            prompt = f"""Analyse this email reply and classify it as one of:
- "positive" (interested, wants to talk, asking questions, open to a call)
- "negative" (not interested, too busy, already has a solution)
- "unsubscribe" (remove me, stop emailing, unsubscribe)
- "neutral" (out of office, unclear)

Reply:
{reply_text[:500]}

Return ONLY one word: positive, negative, unsubscribe, or neutral"""

            message = self.client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=10,
                messages=[{"role": "user", "content": prompt}]
            )
            if not message.content or not getattr(message.content[0], "text", None):
                return "neutral"
            result = message.content[0].text.strip().lower()
            if result in ("positive", "negative", "unsubscribe", "neutral"):
                return result
            return "neutral"
        except Exception:
            return "neutral"

    def generate_daily_report(self, stats: dict, hot_leads: list,
                              sender_email: str) -> tuple[str, str]:
        """Generate the daily summary report email."""
        hot_leads_text = ""
        if hot_leads:
            hot_leads_text = "\n🔥 HOT LEADS TO CALL TODAY:\n"
            for lead in hot_leads[:10]:
                hot_leads_text += f"  • {lead.get('name','Unknown')} — {lead.get('phone','No phone')} — {lead.get('city','')}\n"
        else:
            hot_leads_text = "\n📋 No new hot leads today — keep sending!\n"

        subject = f"📊 LeadStack™ Daily Report — {stats.get('date','Today')}"
        body = f"""\
Good morning!

Here's your LeadStack™ report for {stats.get('date','today')}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 LEADS SCRAPED LAST NIGHT:  {stats.get('scraped', 0)}
📧 EMAILS SENT TODAY:         {stats.get('sent', 0)}
💬 REPLIES RECEIVED:          {stats.get('replied', 0)}
🔥 HOT LEADS:                 {stats.get('hot_leads', 0)}
🤝 MEETINGS BOOKED:           {stats.get('meetings', 0)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL-TIME STATS:
• Total Leads in Database:    {stats.get('total_leads', 0)}
• Total Emails Sent:          {stats.get('emails_sent', 0)}
• Total Replies:              {stats.get('total_replies', 0)}
• Reply Rate:                 {stats.get('open_rate', '0%')}
• Meetings Booked (Total):    {stats.get('total_meetings', 0)}
{hot_leads_text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your machine is running. Keep going. 💪

— LeadStack™
"""
        return subject, body
