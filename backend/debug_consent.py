"""Debug script to screenshot the consent page and find the right button."""
import time
import random
from playwright.sync_api import sync_playwright
import requests

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

query = "independent financial advisor in Austin TX"
search_url = "https://www.google.com/maps/search/" + requests.utils.quote(query)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=random.choice(USER_AGENTS),
        locale="en-US",
        timezone_id="America/New_York",
    )
    page = context.new_page()
    
    print(f"Navigating to: {search_url}")
    page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(3)
    
    # Screenshot
    page.screenshot(path="/tmp/consent_page.png", full_page=False)
    print("Screenshot saved to /tmp/consent_page.png")
    
    # Get all buttons
    buttons = page.query_selector_all('button')
    print(f"\nFound {len(buttons)} buttons:")
    for i, btn in enumerate(buttons[:20]):
        try:
            txt = btn.inner_text().strip()[:60]
            aria = btn.get_attribute('aria-label') or ''
            visible = btn.is_visible()
            print(f"  [{i}] visible={visible} text={txt!r} aria={aria!r}")
        except Exception as e:
            print(f"  [{i}] ERROR: {e}")
    
    # Get all links
    links = page.query_selector_all('a')
    print(f"\nFound {len(links)} links (first 10):")
    for i, lnk in enumerate(links[:10]):
        try:
            txt = lnk.inner_text().strip()[:60]
            href = lnk.get_attribute('href') or ''
            print(f"  [{i}] text={txt!r} href={href[:60]!r}")
        except Exception:
            pass
    
    # Current URL
    print(f"\nCurrent URL: {page.url[:100]}")
    print(f"Page title: {page.title()}")
    
    browser.close()
