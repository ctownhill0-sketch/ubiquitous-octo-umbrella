"""
scraper.py — Advanced Google Maps scraping engine.
Features: Playwright stealth, user-agent rotation, random delays,
deep website crawling for emails + social media links.
"""

import re
import time
import random
import requests
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# compute_lead_score is defined locally below
def compute_lead_score(lead: dict) -> int:
    score = 0
    if lead.get("phone"):    score += 30
    if lead.get("email"):    score += 25
    if lead.get("website"):  score += 15
    if lead.get("linkedin"): score += 10
    try:
        if float(lead.get("rating") or 0) >= 4.0: score += 15
    except (ValueError, TypeError):
        pass
    if lead.get("address"): score += 5
    return min(score, 100)

# ─── User-Agent Pool ──────────────────────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

VIEWPORTS = [
    {"width": 1280, "height": 800},
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1920, "height": 1080},
]

# ─── Email / Social Helpers ───────────────────────────────────────────────────

EMAIL_BLACKLIST = {
    "example.com", "domain.com", "email.com", "yourdomain.com",
    "sentry.io", "wixpress.com", "squarespace.com", "wordpress.com",
    "cloudflare.com", "google.com", "amazonaws.com", "mailchimp.com",
    "sendgrid.net", "hubspot.com", "zendesk.com", "intercom.io",
}

SOCIAL_PATTERNS = {
    "linkedin":  r"https?://(?:www\.)?linkedin\.com/(?:company|in)/[^\s\"'<>]+",
    "twitter":   r"https?://(?:www\.)?(?:twitter|x)\.com/[^\s\"'<>]+",
    "facebook":  r"https?://(?:www\.)?facebook\.com/[^\s\"'<>]+",
    "instagram": r"https?://(?:www\.)?instagram\.com/[^\s\"'<>]+",
}


def extract_emails(text: str) -> list[str]:
    pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
    found = re.findall(pattern, text)
    return list({
        e.lower() for e in found
        if not any(b in e.lower() for b in EMAIL_BLACKLIST)
    })


def extract_social_links(text: str) -> dict:
    result = {}
    for platform, pattern in SOCIAL_PATTERNS.items():
        matches = re.findall(pattern, text)
        if matches:
            # Clean trailing punctuation
            result[platform] = matches[0].rstrip(".,;)'\"")
    return result


def scrape_website(url: str, timeout: int = 10) -> dict:
    """
    Visit a business website and extract emails + social media links.
    Checks homepage, /contact, /about, /team pages.
    Returns dict with keys: emails (list), linkedin, twitter, facebook, instagram.
    """
    if not url:
        return {}

    headers = {"User-Agent": random.choice(USER_AGENTS)}
    base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    pages = [url, base + "/contact", base + "/contact-us", base + "/about"]

    all_emails = set()
    all_social = {}

    for page_url in pages[:3]:
        try:
            resp = requests.get(page_url, headers=headers, timeout=timeout,
                                allow_redirects=True)
            if resp.status_code == 200:
                text = resp.text
                all_emails.update(extract_emails(text))
                for k, v in extract_social_links(text).items():
                    if k not in all_social:
                        all_social[k] = v
        except Exception:
            continue
        if all_emails and len(all_social) >= 2:
            break  # Good enough, stop early

    return {
        "email":     ", ".join(sorted(all_emails)),
        "linkedin":  all_social.get("linkedin", ""),
        "twitter":   all_social.get("twitter", ""),
        "facebook":  all_social.get("facebook", ""),
        "instagram": all_social.get("instagram", ""),
    }


# ─── Google Places API (Nearby Search + multi-keyword) ───────────────────────
# NOTE: Text Search pagination is broken for this key (INVALID_REQUEST on page 2).
# Nearby Search pagination works perfectly (60 results per keyword, 3 pages × 20).
# We run multiple keyword variants to get 100–200+ unique results per city.
PLACES_NEARBY   = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_GEOCODE  = "https://maps.googleapis.com/maps/api/geocode/json"
PLACES_DETAILS  = "https://maps.googleapis.com/maps/api/place/details/json"

# Keyword variants to run per base keyword (deduped by place_id)
KEYWORD_VARIANTS = {
    "default": ["{kw}", "{kw} firm", "{kw} office"],
}

def _geocode_city(city: str, api_key: str) -> tuple[float, float] | None:
    """Convert a city name to (lat, lng) using Geocoding API."""
    try:
        r = requests.get(PLACES_GEOCODE, params={"address": city, "key": api_key}, timeout=10)
        data = r.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]
    except Exception as e:
        print(f"[Places API] Geocode error for '{city}': {e}")
    return None

def _nearby_fetch_ids(keyword: str, lat: float, lng: float, api_key: str,
                      seen_ids: set) -> list[str]:
    """Fetch all available unique place IDs via Nearby Search (up to 3 pages × 20 = 60).
    Always fetches all 3 pages regardless of count — the caller caps the total.
    """
    place_ids = []
    params = {
        "location": f"{lat},{lng}",
        "radius": 50000,
        "keyword": keyword,
        "key": api_key,
    }
    for page in range(3):
        try:
            r = requests.get(PLACES_NEARBY, params=params, timeout=12)
            data = r.json()
            status = data.get("status", "")
            if status == "REQUEST_DENIED":
                print(f"[Places API] Key rejected: {data.get('error_message', '')}")
                break
            if status not in ("OK", "ZERO_RESULTS"):
                print(f"[Places API] Nearby status: {status}")
                break
            for item in data.get("results", []):
                pid = item.get("place_id")
                if pid and pid not in seen_ids and pid not in place_ids:
                    place_ids.append(pid)
            next_token = data.get("next_page_token")
            if not next_token:
                break
            time.sleep(3)  # Google requires ~2s before next_page_token is valid
            params = {"pagetoken": next_token, "key": api_key}
        except Exception as e:
            print(f"[Places API] Nearby fetch error: {e}")
            break
    return place_ids

def _places_fetch_details(place_id: str, api_key: str) -> dict | None:
    """Fetch full details for a place."""
    try:
        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,url,types",
            "key": api_key,
        }
        r = requests.get(PLACES_DETAILS, params=params, timeout=10)
        data = r.json()
        if data.get("status") != "OK":
            return None
        result = data.get("result", {})
        addr = result.get("formatted_address", "")
        city = ""
        parts = [p.strip() for p in addr.split(",")]
        if len(parts) >= 2:
            city = re.sub(r"\s+\w{2}\s+\d{5}.*", "", parts[-2]).strip()
            city = re.sub(r"\s+\d{5}.*", "", city).strip()
        return {
            "name": result.get("name", ""),
            "address": addr,
            "city": city,
            "phone": result.get("formatted_phone_number", ""),
            "website": result.get("website", ""),
            "rating": result.get("rating"),
            "reviews_count": result.get("user_ratings_total"),
            "google_maps_url": result.get("url", f"https://www.google.com/maps/place/?q=place_id:{place_id}"),
            "category": ", ".join(result.get("types", [])[:2]).replace("_", " "),
            "email": "", "linkedin": "", "twitter": "", "facebook": "", "instagram": "",
            "status": "New",
        }
    except Exception as e:
        print(f"[Places API] Details error: {e}")
        return None

# Synonym map: when the base keyword contains one of these, expand with these synonyms
# Each synonym generates a separate Nearby Search (up to 60 results each)
_KEYWORD_SYNONYMS: dict[str, list[str]] = {
    "financial advisor":    ["financial advisor", "wealth management", "investment advisor", "financial planner", "registered investment advisor"],
    "financial adviser":    ["financial adviser", "wealth management", "investment adviser", "financial planner"],
    "accountant":           ["accountant", "accounting firm", "CPA", "tax advisor", "bookkeeper"],
    "lawyer":               ["lawyer", "law firm", "attorney", "legal services"],
    "attorney":             ["attorney", "law firm", "lawyer", "legal services"],
    "real estate agent":    ["real estate agent", "realtor", "real estate broker", "property agent"],
    "insurance agent":      ["insurance agent", "insurance broker", "insurance company"],
    "dentist":              ["dentist", "dental clinic", "dental office", "orthodontist"],
    "doctor":               ["doctor", "physician", "medical clinic", "medical office"],
    "plumber":              ["plumber", "plumbing company", "plumbing services"],
    "electrician":          ["electrician", "electrical contractor", "electrical services"],
    "contractor":           ["contractor", "general contractor", "construction company"],
    "marketing agency":     ["marketing agency", "digital marketing", "advertising agency", "SEO agency"],
    "consultant":           ["consultant", "consulting firm", "business consultant", "management consultant"],
    "gym":                  ["gym", "fitness center", "personal trainer", "health club"],
    "restaurant":           ["restaurant", "cafe", "bistro", "eatery"],
    "hotel":                ["hotel", "motel", "inn", "bed and breakfast"],
    "spa":                  ["spa", "massage therapy", "wellness center", "day spa"],
    "chiropractor":         ["chiropractor", "chiropractic clinic", "chiropractic office"],
    "therapist":            ["therapist", "psychologist", "counselor", "mental health"],
}

def _build_keyword_variants(keyword: str) -> list[str]:
    """Generate keyword variants to maximise unique results from Nearby Search.
    Uses synonym map for known categories; falls back to the base keyword only.
    """
    kw = keyword.strip().lower()
    # Check if any synonym key is contained in the keyword
    for key, synonyms in _KEYWORD_SYNONYMS.items():
        if key in kw:
            # Return synonyms, preserving original capitalisation for the first one
            return synonyms
    # No match: just use the original keyword (single query, up to 60 results)
    return [keyword.strip()]

# ─── Main Scraper ─────────────────────────────────────────────────────────────

class GoogleMapsScraper:
    """
    Scrapes Google Maps listings using Playwright with stealth settings.
    Calls progress_callback(current, total, message) during execution.
    Calls lead_callback(lead_dict) for each completed lead (for live UI updates).
    Set stop_flag to True to abort mid-run.
    """

    def __init__(self, progress_callback=None, lead_callback=None):
        self.progress_callback = progress_callback
        self.lead_callback = lead_callback
        self.stop_flag = False

    def _emit(self, current, total, message):
        if self.progress_callback:
            self.progress_callback(current, total, message)

    def _get_api_key(self) -> str:
        """Load Google Maps API key from database settings."""
        try:
            from database import Database
            db = Database()
            key = db.get_setting("google_maps_api_key", "")
            return key.strip() if key else ""
        except Exception:
            return ""

    def search(self, keyword: str, city: str, max_results: int = 20,
               search_keyword: str = "", search_city: str = "") -> list[dict]:
        """
        Main entry point. Returns list of lead dicts.
        Uses Google Places Nearby Search (multi-keyword, 3 pages each) if API key is set.
        Falls back to Playwright HTML scraping if no key.
        """
        results = []
        self.stop_flag = False

        # ── Try Google Places API (Nearby Search) ───────────────────────────
        api_key = self._get_api_key()
        if api_key:
            self._emit(0, max_results, f"[Places API] Geocoding city: {city}")
            coords = _geocode_city(city, api_key)
            if not coords:
                # Fallback: try common city coordinates
                self._emit(0, max_results, f"[Places API] Geocode failed for '{city}', using text search fallback")
                coords = (40.7128, -74.0060)  # Default to NYC if geocode fails
            lat, lng = coords
            self._emit(0, max_results, f"[Places API] Searching {keyword} near {city} ({lat:.4f}, {lng:.4f})")

            # Build keyword variants to maximise unique results
            variants = _build_keyword_variants(keyword)
            seen_ids: set = set()
            all_place_ids: list[str] = []

            for vi, variant in enumerate(variants):
                if self.stop_flag:
                    break
                self._emit(len(all_place_ids), max_results,
                           f"[Places API] Variant {vi+1}/{len(variants)}: '{variant}'")
                # Always collect ALL pages for each variant — cap happens after all variants run
                new_ids = _nearby_fetch_ids(variant, lat, lng, api_key, seen_ids)
                all_place_ids.extend(new_ids)
                seen_ids.update(new_ids)
                print(f"[Places API] Variant '{variant}': {len(new_ids)} new IDs (total: {len(all_place_ids)})")

            # Cap to max_results AFTER all variants have run
            all_place_ids = all_place_ids[:max_results]
            total_ids = len(all_place_ids)
            self._emit(0, total_ids, f"[Places API] {total_ids} unique places found — fetching details...")

            for i, pid in enumerate(all_place_ids):
                if self.stop_flag:
                    break
                lead = _places_fetch_details(pid, api_key)
                if not lead:
                    continue
                lead["search_keyword"] = search_keyword or keyword
                lead["search_city"]    = search_city or city
                # Save lead immediately WITHOUT website crawling so the frontend
                # gets all leads fast. Website enrichment runs in a background thread.
                lead["lead_score"] = compute_lead_score(lead)
                results.append(lead)
                if self.lead_callback:
                    self.lead_callback(lead)
                self._emit(i + 1, total_ids, f"Fetched {i+1}/{total_ids}: {lead.get('name','')}")

            self._emit(len(results), len(results),
                       f"Done! {len(results)} leads collected via Places API.")

            # ── Background website enrichment ──────────────────────────────────
            # Enrich websites in a background thread so the caller gets all leads
            # immediately without waiting for potentially 100+ HTTP requests.
            leads_to_enrich = [l for l in results if l.get("website")]
            if leads_to_enrich and self.lead_callback:
                def _enrich_bg(leads_ref, cb):
                    for lead in leads_ref:
                        try:
                            web_data = scrape_website(lead["website"])
                            if web_data.get("email") or web_data.get("linkedin"):
                                lead.update(web_data)
                                lead["lead_score"] = compute_lead_score(lead)
                                cb(lead)  # re-emit so server can update DB
                        except Exception:
                            pass
                        time.sleep(random.uniform(0.2, 0.5))
                import threading as _threading
                _threading.Thread(
                    target=_enrich_bg,
                    args=(leads_to_enrich, self.lead_callback),
                    daemon=True
                ).start()

            return results

        # ── Playwright fallback ────────────────────────────────────────────────
        self._emit(0, max_results, "No API key — using Playwright scraper (add key in Settings for more results)")

        with sync_playwright() as p:
            ua = random.choice(USER_AGENTS)
            vp = random.choice(VIEWPORTS)

            browser = p.chromium.launch(headless=True)
            context = None
            page = None
            try:
                context = browser.new_context(
                    viewport=vp,
                    user_agent=ua,
                    locale="en-US",
                    timezone_id="America/New_York",
                )

                # Pre-set Google consent cookies to bypass the GDPR consent page
                context.add_cookies([
                    {"name": "CONSENT",
                     "value": "YES+cb.20210720-07-p0.en+FX+410",
                     "domain": ".google.com", "path": "/"},
                    {"name": "SOCS",
                     "value": "CAESEwgDEgk0ODE3Nzk3MjkaAmVuIAEaBgiA_LyaBg",
                     "domain": ".google.com", "path": "/"},
                ])

                page = context.new_page()

                # Block images/fonts to speed up loading
                page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", lambda r: r.abort())

                self._emit(0, max_results, f"Searching Google Maps: {query}")
                search_url = (
                    "https://www.google.com/maps/search/"
                    + requests.utils.quote(query)
                )
                page.goto(search_url, wait_until="networkidle", timeout=30000)
                self._random_sleep(2, 3)

                # Fallback: handle consent page if cookies didn't work
                if "consent.google.com" in page.url:
                    self._handle_consent(page)
                    self._random_sleep(2, 3)

                self._emit(0, max_results, "Loading listings (scrolling)...")
                self._scroll_results(page, max_results)

                links = self._collect_links(page, max_results)
                total = len(links)
                self._emit(0, total, f"Found {total} listings. Extracting details...")

                for idx, link in enumerate(links):
                    if self.stop_flag:
                        self._emit(idx, total, "Stopped by user.")
                        break
                    try:
                        self._emit(idx, total, f"Scraping {idx+1}/{total}: opening listing...")
                        data = self._extract_listing(page, link)
                        if not data:
                            continue

                        data["search_keyword"] = search_keyword or keyword
                        data["search_city"]    = search_city or city

                        # Deep-scrape website for email + social
                        if data.get("website"):
                            self._emit(idx, total,
                                       f"Scraping {idx+1}/{total}: checking website for email...")
                            web_data = scrape_website(data["website"])
                            data.update(web_data)

                        data["lead_score"] = compute_lead_score(data)
                        results.append(data)

                        if self.lead_callback:
                            self.lead_callback(data)

                        self._random_sleep(0.8, 1.8)
                    except Exception as e:
                        print(f"[WARN] Listing {idx+1} error: {e}")
                        continue
            finally:
                # Always close in reverse order, even on exception, to avoid
                # leaking Chromium processes between scrapes.
                try:
                    if page: page.close()
                except Exception: pass
                try:
                    if context: context.close()
                except Exception: pass
                try:
                    browser.close()
                except Exception: pass

        self._emit(len(results), len(results),
                   f"Done! {len(results)} leads collected.")
        return results

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _random_sleep(self, min_s=1.0, max_s=2.5):
        time.sleep(random.uniform(min_s, max_s))

    def _handle_consent(self, page):
        """Click through Google's consent/cookie page if present."""
        try:
            # Only act if we're on a consent page
            url = page.url
            if 'consent.google.com' not in url and 'consent' not in url:
                return

            print("[INFO] Consent page detected — attempting to accept...")

            # Find the first visible button and click it (the accept/agree button)
            # Google shows 'Accept all' / 'Zaakceptuj wszystko' etc. in local language
            # We pick the SECOND visible button (index 1) which is always 'Accept all'
            # (index 0 is the language selector, index 2 is 'Reject all')
            buttons = page.query_selector_all('button')
            visible_btns = []
            for btn in buttons:
                try:
                    if btn.is_visible():
                        visible_btns.append(btn)
                except Exception:
                    pass

            # Try clicking the button with 'accept' in aria-label (any language)
            # Google always puts aria-label in English even on localised pages
            for btn in visible_btns:
                try:
                    aria = (btn.get_attribute('aria-label') or '').lower()
                    txt  = (btn.inner_text() or '').strip().lower()
                    # Match English or any language accept button
                    if any(w in aria for w in ['accept all', 'zaakceptuj', 'accepter', 'aceptar', 'alle akzeptieren', 'accetta']):
                        btn.click()
                        print(f"[INFO] Clicked consent accept button (aria): {aria}")
                        time.sleep(3)
                        return
                    if any(w in txt for w in ['accept all', 'zaakceptuj', 'accepter', 'aceptar', 'alle akzeptieren', 'accetta']):
                        btn.click()
                        print(f"[INFO] Clicked consent accept button (text): {txt}")
                        time.sleep(3)
                        return
                except Exception:
                    continue

            # Last resort: click the last visible button (usually 'Accept all')
            if len(visible_btns) >= 2:
                try:
                    # Skip language button (first), click accept (usually index 1 or 2)
                    for btn in visible_btns[1:]:
                        aria = (btn.get_attribute('aria-label') or '').lower()
                        if 'reject' not in aria and 'odrzuć' not in aria:
                            btn.click()
                            print(f"[INFO] Clicked fallback consent button")
                            time.sleep(3)
                            return
                except Exception:
                    pass
        except Exception as e:
            print(f"[INFO] Consent handler error: {e}")

    def _scroll_results(self, page, max_results: int):
        # Try multiple feed selectors — Google Maps changes these periodically
        feed_selectors = [
            'div[role="feed"]',
            'div[aria-label*="Results for"]',
            'div[aria-label*="result"]',
            'div.m6QErb[aria-label]',
            'div.m6QErb',
        ]
        feed = None
        for sel in feed_selectors:
            try:
                page.wait_for_selector(sel, timeout=8000)
                feed = page.query_selector(sel)
                if feed:
                    print(f"[INFO] Feed found with selector: {sel}")
                    break
            except Exception:
                continue

        if not feed:
            print("[WARN] Could not find results feed — page may not have loaded")
            return

        prev = 0
        for _ in range(max(6, max_results // 5)):
            try:
                feed.evaluate("el => el.scrollBy(0, 1500)")
            except Exception:
                try:
                    page.evaluate("window.scrollBy(0, 1500)")
                except Exception:
                    pass
            self._random_sleep(1.5, 2.5)
            items = page.query_selector_all('a[href*="/maps/place/"]')
            cur = len(items)
            if cur >= max_results:
                break
            if cur == prev:
                self._random_sleep(2, 3)
                items = page.query_selector_all('a[href*="/maps/place/"]')
                if len(items) == prev:
                    break
            prev = cur

    def _collect_links(self, page, max_results: int) -> list[str]:
        try:
            links = page.eval_on_selector_all(
                'div[role="feed"] a[href*="/maps/place/"]',
                "els => els.map(el => el.href)"
            )
            seen, unique = set(), []
            for l in links:
                if l not in seen:
                    seen.add(l)
                    unique.append(l)
            return unique[:max_results]
        except Exception as e:
            print(f"[WARN] Link collect: {e}")
            return []

    def _extract_listing(self, page, url: str) -> dict | None:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            self._random_sleep(1.5, 2.5)

            data = {k: "" for k in [
                "name", "category", "address", "phone", "website",
                "rating", "reviews_count", "hours", "plus_code",
                "google_maps_url", "email", "linkedin", "twitter",
                "facebook", "instagram",
            ]}
            data["google_maps_url"] = url

            # Name
            try:
                el = page.query_selector('h1.DUwDvf, h1[class*="fontHeadlineLarge"]')
                if el:
                    data["name"] = el.inner_text().strip()
            except Exception:
                pass

            # Category
            try:
                el = page.query_selector('button[jsaction*="category"], span.DkEaL')
                if el:
                    data["category"] = el.inner_text().strip()
            except Exception:
                pass

            # Rating
            try:
                el = page.query_selector('div.F7nice span[aria-hidden="true"]')
                if el:
                    data["rating"] = el.inner_text().strip()
            except Exception:
                pass

            # Reviews count
            try:
                el = page.query_selector('div.F7nice span[aria-label*="review"]')
                if el:
                    aria = el.get_attribute("aria-label") or ""
                    nums = re.findall(r"[\d,]+", aria)
                    if nums:
                        data["reviews_count"] = nums[0].replace(",", "")
            except Exception:
                pass

            # Info rows (address, phone, website, hours)
            try:
                for row in page.query_selector_all('div[data-item-id]'):
                    item_id = row.get_attribute("data-item-id") or ""
                    text = row.inner_text().strip()

                    if "address" in item_id.lower():
                        data["address"] = text.split("\n")[0]
                    elif "phone" in item_id.lower():
                        m = re.search(r"[\(\+]?[\d\(\)\s\-\.]{7,20}", text)
                        if m:
                            data["phone"] = m.group().strip()
                    elif "authority" in item_id.lower() or "website" in item_id.lower():
                        a = row.query_selector("a")
                        if a:
                            href = a.get_attribute("href") or ""
                            if href.startswith("http"):
                                data["website"] = href
                    elif "oloc" in item_id.lower():
                        data["plus_code"] = text.split("\n")[0]
            except Exception as e:
                print(f"[WARN] Info rows: {e}")

            # Fallback: address via aria-label
            if not data["address"]:
                try:
                    btn = page.query_selector('button[data-item-id="address"]')
                    if btn:
                        aria = btn.get_attribute("aria-label") or ""
                        data["address"] = aria.replace("Address: ", "").strip() or \
                                          btn.inner_text().strip().split("\n")[0]
                except Exception:
                    pass

            # Fallback: address via class
            if not data["address"]:
                try:
                    el = page.query_selector('[data-item-id="address"] .Io6YTe')
                    if el:
                        data["address"] = el.inner_text().strip()
                except Exception:
                    pass

            # Fallback: phone via aria-label
            if not data["phone"]:
                try:
                    btn = page.query_selector('button[data-item-id^="phone"]')
                    if btn:
                        aria = btn.get_attribute("aria-label") or ""
                        data["phone"] = aria.replace("Phone: ", "").strip() or \
                                        btn.inner_text().strip()
                except Exception:
                    pass

            # Fallback: website
            if not data["website"]:
                try:
                    a = page.query_selector('a[data-item-id*="authority"]')
                    if a:
                        data["website"] = a.get_attribute("href") or ""
                except Exception:
                    pass

            # Hours
            try:
                tbl = page.query_selector('div[aria-label*="Hours"] table')
                if tbl:
                    data["hours"] = tbl.inner_text().replace("\n", "; ").strip()
            except Exception:
                pass

            return data if data["name"] else None

        except PlaywrightTimeout:
            print(f"[WARN] Timeout: {url}")
            return None
        except Exception as e:
            print(f"[WARN] Extract: {e}")
            return None
