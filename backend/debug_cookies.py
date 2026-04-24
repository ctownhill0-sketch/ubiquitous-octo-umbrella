"""Bypass Google consent using pre-set cookies — standard professional technique."""
import time, requests
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
query = "independent financial advisor in Austin TX"
search_url = "https://www.google.com/maps/search/" + requests.utils.quote(query)

# Google consent bypass cookies
CONSENT_COOKIES = [
    {
        "name": "CONSENT",
        "value": "YES+cb.20210720-07-p0.en+FX+410",
        "domain": ".google.com",
        "path": "/",
    },
    {
        "name": "SOCS",
        "value": "CAESEwgDEgk0ODE3Nzk3MjkaAmVuIAEaBgiA_LyaBg",
        "domain": ".google.com",
        "path": "/",
    },
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=UA, locale="en-US", timezone_id="America/New_York",
    )
    
    # Add consent cookies BEFORE navigating
    ctx.add_cookies(CONSENT_COOKIES)
    print("Consent cookies set.")
    
    page = ctx.new_page()
    page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", lambda r: r.abort())

    print(f"Navigating to: {search_url[:80]}")
    page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(4)
    
    print(f"URL: {page.url[:80]}")
    print(f"Title: {page.title()}")
    
    # Check if we bypassed consent
    if "consent.google.com" in page.url:
        print("STILL on consent page — cookies didn't work")
    else:
        print("SUCCESS: Bypassed consent page!")
    
    # Check for place links
    links = page.eval_on_selector_all('a[href*="/maps/place/"]', "els => els.map(el => el.href)")
    print(f"Place links: {len(links)}")
    for l in links[:5]:
        print(f"  {l[:80]}")
    
    # Check for feed
    for sel in ['div[role="feed"]', 'div.m6QErb', '[role="main"]']:
        els = page.query_selector_all(sel)
        print(f"  {sel!r}: {len(els)} elements")
    
    browser.close()
    print("DONE")
