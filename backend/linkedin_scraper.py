# LeadStack™ LinkedIn Scraper v1.0
# Uses Playwright for headless LinkedIn scraping.
# Requires user to log in once via the OAuth/cookie flow — then sessions persist.
# Scrapes: name, title, company, location, profile URL, connection degree.

import json
import time
import random
import sqlite3
import os
import re
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "money_machine.db")

# ─── Stealth helpers ──────────────────────────────────────────────────────────

def _random_delay(min_s=1.2, max_s=3.5):
    time.sleep(random.uniform(min_s, max_s))

def _human_type(page, selector: str, text: str):
    """Type text character by character with random delays to mimic human input."""
    page.click(selector)
    for char in text:
        page.keyboard.type(char)
        time.sleep(random.uniform(0.05, 0.18))

# ─── Session management ───────────────────────────────────────────────────────

COOKIES_PATH = os.path.join(os.path.dirname(__file__), "linkedin_cookies.json")

def save_cookies(context):
    cookies = context.cookies()
    with open(COOKIES_PATH, "w") as f:
        json.dump(cookies, f)

def load_cookies(context):
    if os.path.exists(COOKIES_PATH):
        with open(COOKIES_PATH) as f:
            cookies = json.load(f)
        context.add_cookies(cookies)
        return True
    return False

def is_logged_in(page) -> bool:
    try:
        page.goto("https://www.linkedin.com/feed/", timeout=15000)
        _random_delay(1, 2)
        return "feed" in page.url and page.query_selector('[data-test-id="nav-settings__account-menu"]') is not None or \
               page.query_selector('.global-nav__me-photo') is not None or \
               "feed" in page.url
    except Exception:
        return False

# ─── Core scraper ─────────────────────────────────────────────────────────────

def scrape_linkedin_leads(
    keyword: str,
    location: str = "",
    max_results: int = 25,
    filters: Optional[dict] = None,
    progress_callback=None,
    stop_event=None,
) -> list[dict]:
    """
    Scrape LinkedIn Sales Navigator or People Search for leads.
    Returns list of lead dicts compatible with LeadStack DB schema.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return [{"error": "playwright_not_installed"}]

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--window-size=1366,768",
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 768},
            locale="en-US",
        )

        # Load saved session cookies
        has_session = load_cookies(context)
        page = context.new_page()

        # Check if still logged in
        logged_in = False
        if has_session:
            logged_in = is_logged_in(page)

        if not logged_in:
            # Return a special signal so the frontend can show the login modal
            browser.close()
            return [{"error": "linkedin_not_logged_in"}]

        # Build search URL
        query_parts = [keyword]
        if location:
            query_parts.append(location)
        query = " ".join(query_parts)

        # Use LinkedIn People Search
        search_url = f"https://www.linkedin.com/search/results/people/?keywords={query.replace(' ', '%20')}&origin=GLOBAL_SEARCH_HEADER"

        # Apply filters if provided
        if filters:
            if filters.get("connection_degree"):
                deg = filters["connection_degree"]  # "F", "S", "O"
                search_url += f"&network=%5B%22{deg}%22%5D"
            if filters.get("company"):
                search_url += f"&currentCompany=%5B%22{filters['company']}%22%5D"

        page.goto(search_url, timeout=20000)
        _random_delay(2, 4)

        leads_found = 0
        page_num = 1

        while leads_found < max_results:
            if stop_event and stop_event.is_set():
                break

            # Wait for results to load
            try:
                page.wait_for_selector(".reusable-search__result-container", timeout=10000)
            except Exception:
                break

            # Extract profile cards
            cards = page.query_selector_all(".reusable-search__result-container")

            for card in cards:
                if leads_found >= max_results:
                    break
                if stop_event and stop_event.is_set():
                    break

                try:
                    lead = _extract_card_data(card)
                    if lead and lead.get("name"):
                        results.append(lead)
                        leads_found += 1
                        if progress_callback:
                            progress_callback(leads_found, max_results, lead.get("name", ""))
                        _random_delay(0.3, 0.8)
                except Exception:
                    continue

            # Go to next page
            next_btn = page.query_selector('[aria-label="Next"]')
            if not next_btn or leads_found >= max_results:
                break

            next_btn.click()
            page_num += 1
            _random_delay(2.5, 5)

        # Save updated cookies
        save_cookies(context)
        browser.close()

    return results


def _extract_card_data(card) -> Optional[dict]:
    """Extract lead data from a LinkedIn search result card."""
    try:
        # Name
        name_el = card.query_selector(".entity-result__title-text a span[aria-hidden='true']")
        if not name_el:
            name_el = card.query_selector(".entity-result__title-text")
        name = name_el.inner_text().strip() if name_el else ""

        # Remove "View X's profile" suffix
        name = re.sub(r"\s*View.*profile.*", "", name, flags=re.IGNORECASE).strip()
        if not name or name.lower() == "linkedin member":
            return None

        # Title / headline
        title_el = card.query_selector(".entity-result__primary-subtitle")
        title = title_el.inner_text().strip() if title_el else ""

        # Location
        loc_el = card.query_selector(".entity-result__secondary-subtitle")
        location = loc_el.inner_text().strip() if loc_el else ""

        # Profile URL
        link_el = card.query_selector(".entity-result__title-text a")
        profile_url = link_el.get_attribute("href") if link_el else ""
        if profile_url and "?" in profile_url:
            profile_url = profile_url.split("?")[0]

        # Company (from title if format is "Title at Company")
        company = ""
        if " at " in title:
            parts = title.split(" at ", 1)
            company = parts[1].strip()
            title = parts[0].strip()
        elif " | " in title:
            parts = title.split(" | ", 1)
            title = parts[0].strip()
            company = parts[1].strip() if len(parts) > 1 else ""

        # Connection degree
        degree_el = card.query_selector(".dist-value")
        degree = degree_el.inner_text().strip() if degree_el else ""

        # Profile image
        img_el = card.query_selector(".presence-entity__image")
        if not img_el:
            img_el = card.query_selector("img.EntityPhoto-circle-4")
        photo_url = img_el.get_attribute("src") if img_el else ""

        return {
            "name": name,
            "title": title,
            "company": company,
            "location": location,
            "profile_url": profile_url,
            "connection_degree": degree,
            "photo_url": photo_url,
            "source": "linkedin",
            "scraped_at": datetime.now().isoformat(),
        }
    except Exception:
        return None


# ─── Database integration ─────────────────────────────────────────────────────

def save_linkedin_leads_to_db(leads: list[dict]) -> dict:
    """Save scraped LinkedIn leads to the LeadStack database."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    saved = 0
    skipped = 0

    for lead in leads:
        if lead.get("error"):
            continue
        name = lead.get("name", "")
        company = lead.get("company", "")
        location = lead.get("location", "")
        title = lead.get("title", "")
        profile_url = lead.get("profile_url", "")

        if not name:
            skipped += 1
            continue

        # Check for duplicate by profile URL or name+company
        if profile_url:
            existing = c.execute("SELECT id FROM leads WHERE website = ?", (profile_url,)).fetchone()
        else:
            existing = c.execute(
                "SELECT id FROM leads WHERE name = ? AND company = ?", (name, company)
            ).fetchone()

        if existing:
            skipped += 1
            continue

        # Build a placeholder email from name+company (will be enriched later)
        first = name.split()[0].lower() if name else "contact"
        domain_guess = ""
        if company:
            domain_guess = re.sub(r"[^a-z0-9]", "", company.lower())[:20] + ".com"
        email_placeholder = f"{first}@{domain_guess}" if domain_guess else ""

        notes = f"LinkedIn: {title}" if title else "LinkedIn lead"

        c.execute("""
            INSERT INTO leads (name, email, company, phone, website, city, state, category, status, notes, lead_score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            email_placeholder,
            company,
            "",
            profile_url,
            location,
            "",
            "LinkedIn",
            "New",
            notes,
            50,
            datetime.now().isoformat(),
        ))
        saved += 1

    conn.commit()
    conn.close()
    return {"saved": saved, "skipped": skipped, "total": len(leads)}


# ─── Cookie-based login helper ────────────────────────────────────────────────

def get_linkedin_login_url() -> str:
    """Return the LinkedIn login URL for the user to authenticate."""
    return "https://www.linkedin.com/login"


def check_linkedin_session() -> dict:
    """Check if a valid LinkedIn session exists."""
    if not os.path.exists(COOKIES_PATH):
        return {"logged_in": False, "reason": "no_session"}
    try:
        with open(COOKIES_PATH) as f:
            cookies = json.load(f)
        # Check for li_at cookie (LinkedIn auth token)
        li_at = next((c for c in cookies if c.get("name") == "li_at"), None)
        if not li_at:
            return {"logged_in": False, "reason": "no_auth_cookie"}
        # Check expiry
        exp = li_at.get("expires", 0)
        if exp > 0 and exp < time.time():
            return {"logged_in": False, "reason": "session_expired"}
        return {"logged_in": True}
    except Exception as e:
        return {"logged_in": False, "reason": str(e)}


def open_linkedin_login_browser():
    """Open a visible browser window for the user to log in to LinkedIn."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"error": "playwright_not_installed"}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        page = context.new_page()
        page.goto("https://www.linkedin.com/login")

        # Wait for user to log in (up to 3 minutes)
        try:
            page.wait_for_url("**/feed/**", timeout=180000)
            save_cookies(context)
            browser.close()
            return {"success": True, "message": "LinkedIn session saved"}
        except Exception:
            browser.close()
            return {"error": "Login timed out or was cancelled"}
