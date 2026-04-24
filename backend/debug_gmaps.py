"""Debug script to inspect Google Maps HTML structure."""
import time
import random
import requests
from playwright.sync_api import sync_playwright

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

query = "independent financial advisor in Austin TX"
search_url = "https://www.google.com/maps/search/" + requests.utils.quote(query)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=random.choice(USER_AGENTS),
        locale="en-US",
    )
    page = context.new_page()
    page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", lambda r: r.abort())
    
    print(f"Navigating to: {search_url}")
    page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(4)
    
    # Try multiple selectors
    selectors_to_try = [
        'div[role="feed"]',
        'div[aria-label*="Results"]',
        'div[aria-label*="result"]',
        '[role="main"]',
        'div.m6QErb',
        'div[jsaction*="mouseover"]',
        'a[href*="/maps/place/"]',
    ]
    
    print("\n--- Selector test ---")
    for sel in selectors_to_try:
        try:
            els = page.query_selector_all(sel)
            print(f"  {sel!r:45s} → {len(els)} elements")
        except Exception as e:
            print(f"  {sel!r:45s} → ERROR: {e}")
    
    # Get all place links
    links = page.eval_on_selector_all(
        'a[href*="/maps/place/"]',
        "els => els.map(el => el.href)"
    )
    print(f"\n--- Place links found: {len(links)} ---")
    for l in links[:5]:
        print(f"  {l[:100]}")
    
    # Save HTML snapshot
    html = page.content()
    with open("/tmp/gmaps_debug.html", "w") as f:
        f.write(html)
    print(f"\nHTML saved to /tmp/gmaps_debug.html ({len(html)} chars)")
    
    browser.close()
