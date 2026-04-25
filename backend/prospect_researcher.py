"""
prospect_researcher.py — AI Prospect Research Engine
Uses Claude to research companies and generate hyper-personalised first lines.
"""

import json
import re
import urllib.request
import urllib.parse
from typing import Optional


class ProspectResearcher:
    """
    Researches a prospect using public web signals and generates
    a hyper-personalised opening line for cold emails.
    """

    def __init__(self, api_key: str, sender_name: str = ""):
        self.api_key = api_key
        self.sender_name = sender_name

    def _fetch_url(self, url: str, timeout: int = 6) -> str:
        """Fetch a URL and return raw text, silently failing."""
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; LeadStackBot/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read(8000).decode("utf-8", errors="ignore")
                # Strip HTML tags
                clean = re.sub(r"<[^>]+>", " ", raw)
                clean = re.sub(r"\s+", " ", clean).strip()
                return clean[:3000]
        except Exception:
            return ""

    def _google_snippet(self, query: str) -> str:
        """Get a Google search snippet for a query."""
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://www.google.com/search?q={encoded}&num=3"
            text = self._fetch_url(url, timeout=8)
            # Extract visible text snippets
            snippets = re.findall(r'(?:class="[^"]*"[^>]*>)([A-Z][^<]{40,200})', text)
            return " | ".join(snippets[:3]) if snippets else ""
        except Exception:
            return ""

    def _fetch_website_snippet(self, website: str) -> str:
        """Fetch the homepage of a company website."""
        if not website:
            return ""
        url = website if website.startswith("http") else f"https://{website}"
        return self._fetch_url(url)

    def research_prospect(self, lead: dict) -> dict:
        """
        Research a prospect and return enriched data + personalised first line.

        Returns:
            {
                "personalised_line": str,
                "research_notes": str,
                "company_signals": list[str],
                "recommended_angle": str,
            }
        """
        name = lead.get("name", "")
        company = lead.get("name", "")  # In Google Maps leads, name = company
        website = lead.get("website", "")
        city = lead.get("city", "")
        category = lead.get("category", "")
        rating = lead.get("rating", "")
        reviews = lead.get("reviews_count", "")

        # Gather signals
        signals = []

        # Signal 1: Website content
        site_text = self._fetch_website_snippet(website)
        if site_text:
            signals.append(f"Website content: {site_text[:500]}")

        # Signal 2: Google search
        search_query = f'"{company}" {city} {category}'
        google_text = self._google_snippet(search_query)
        if google_text:
            signals.append(f"Google signals: {google_text[:400]}")

        # Signal 3: Rating signal
        if rating:
            try:
                r = float(rating)
                if r >= 4.5:
                    signals.append(f"Highly rated ({rating} stars, {reviews} reviews) — clearly delivering strong client results")
                elif r >= 4.0:
                    signals.append(f"Well-rated ({rating} stars) with solid reputation")
                elif r < 3.5:
                    signals.append(f"Below-average rating ({rating} stars) — may be struggling with client experience")
            except (ValueError, TypeError):
                pass

        signals_text = "\n".join(signals) if signals else "No additional signals found."

        # Build Claude prompt
        prompt = f"""You are an expert B2B cold email copywriter. Research the following prospect and write ONE hyper-personalised opening line for a cold email.

PROSPECT:
- Company: {company}
- Location: {city}
- Category: {category}
- Website: {website}
- Rating: {rating} ({reviews} reviews)

RESEARCH SIGNALS:
{signals_text}

TASK:
1. Write ONE opening line (15-25 words max) that:
   - References something SPECIFIC about their business (not generic)
   - Sounds like you did your homework, not like a template
   - Creates curiosity or a connection point
   - Does NOT mention their rating or reviews directly
   - Does NOT start with "I" or "I noticed"
   - Sounds natural and human

2. Identify the best ANGLE to use (growth, pain point, opportunity, compliment, recent news)

3. Write 2-3 bullet points of research notes

Respond in this exact JSON format:
{{
  "personalised_line": "...",
  "recommended_angle": "...",
  "research_notes": ["...", "...", "..."]
}}"""

        try:
            import urllib.request as req_lib
            payload = json.dumps({
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": 400,
                "messages": [{"role": "user", "content": prompt}]
            }).encode()

            request = req_lib.Request(
                "https://api.anthropic.com/v1/messages",
                data=payload,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                method="POST"
            )
            with req_lib.urlopen(request, timeout=20) as resp:
                data = json.loads(resp.read())
                # Anthropic responses can return empty content lists or
                # surface API errors in the body — guard both cases so we
                # fall through to the deterministic fallback below.
                content = data.get("content") or []
                text = (content[0].get("text", "") if content else "").strip()
                if text:
                    match = re.search(r'\{.*\}', text, re.DOTALL)
                    if match:
                        result = json.loads(match.group())
                        return {
                            "personalised_line": result.get("personalised_line", ""),
                            "recommended_angle": result.get("recommended_angle", ""),
                            "research_notes": result.get("research_notes", []),
                            "company_signals": signals[:3],
                            "success": True,
                        }
        except Exception as e:
            print(f"[Researcher] API error for {company}: {e}")

        # Fallback: generate a decent line from available data
        fallback_line = self._fallback_line(company, city, category, rating, reviews)
        return {
            "personalised_line": fallback_line,
            "recommended_angle": "local authority",
            "research_notes": [f"Based in {city}", f"Category: {category}"],
            "company_signals": signals[:3],
            "success": False,
        }

    def _fallback_line(self, company: str, city: str, category: str,
                       rating: str, reviews: str) -> str:
        """Generate a decent personalised line without Claude."""
        try:
            r = float(rating or 0)
            rv = int(reviews or 0)
            if r >= 4.5 and rv > 50:
                return f"Building a {r}-star reputation with {rv}+ clients in {city} takes real discipline — impressive."
            elif r >= 4.0:
                return f"Your reputation in {city}'s {category.lower()} space clearly speaks for itself."
        except (ValueError, TypeError):
            pass
        if city and category:
            return f"Came across {company} while looking at top {category.lower()} firms in {city} — stood out immediately."
        return f"Came across {company} and wanted to reach out directly."
