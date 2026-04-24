"""Cookie bypass + proper wait for Google Maps to render."""
import time, requests
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
query = "independent financial advisor in Austin TX"
search_url = "https://www.google.com/maps/search/" + requests.utils.quote(query)

CONSENT_COOKIES = [
    {"name": "CONSENT", "value": "YES+cb.20210720-07-p0.en+FX+410", "domain": ".google.com", "path": "/"},
    {"name": "SOCS", "value": "CAESEwgDEgk0ODE3Nzk3MjkaAmVuIAEaBgiA_LyaBg", "domain": ".google.com", "path": "/"},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=UA, locale="en-US", timezone_id="America/New_York",
    )
    ctx.add_cookies(CONSENT_COOKIES)
    
    page = ctx.new_page()
    page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", lambda r: r.abort())

    print("Navigating...")
    page.goto(search_url, wait_until="networkidle", timeout=30000)
    time.sleep(3)
    print(f"URL: {page.url[:80]}")
    
    # Try waiting for feed with longer timeout
    feed_selectors = [
        'div[role="feed"]',
        'div[aria-label*="Results"]',
        'div[aria-label*="result"]',
        'div.m6QErb',
        'a[href*="/maps/place/"]',
    ]
    
    for sel in feed_selectors:
        try:
            page.wait_for_selector(sel, timeout=15000)
            count = len(page.query_selector_all(sel))
            print(f"  FOUND {sel!r}: {count} elements")
            break
        except Exception:
            print(f"  NOT FOUND: {sel!r}")
    
    # Get all place links
    links = page.eval_on_selector_all('a[href*="/maps/place/"]', "els => els.map(el => el.href)")
    seen, unique = set(), []
    for l in links:
        if l not in seen:
            seen.add(l)
            unique.append(l)
    print(f"\nPlace links: {len(unique)}")
    for l in unique[:5]:
        print(f"  {l[:80]}")
    
    if unique:
        # Test extracting one listing
        print(f"\nExtracting first listing: {unique[0][:60]}")
        page.goto(unique[0], wait_until="domcontentloaded", timeout=20000)
        time.sleep(2)
        
        name = ""
        try:
            el = page.query_selector("h1.DUwDvf, h1[class*='fontHeadlineLarge']")
            if el: name = el.inner_text().strip()
        except Exception: pass
        
        phone = ""
        try:
            btn = page.query_selector('button[data-item-id^="phone"]')
            if btn:
                aria = btn.get_attribute("aria-label") or ""
                phone = aria.replace("Phone: ", "").strip()
        except Exception: pass
        
        print(f"  Name: {name}")
        print(f"  Phone: {phone}")
        print("SUCCESS!")
    
    browser.close()
