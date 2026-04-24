"""Test consent click with no_wait_after=True."""
import time, requests
from playwright.sync_api import sync_playwright

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
query = "independent financial advisor in Austin TX"
search_url = "https://www.google.com/maps/search/" + requests.utils.quote(query)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=UA, locale="en-US", timezone_id="America/New_York",
    )
    page = ctx.new_page()
    page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", lambda r: r.abort())

    print("Navigating...")
    page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(2)
    print(f"URL: {page.url[:80]}")

    if "consent.google.com" in page.url:
        print("Consent page. Clicking with no_wait_after=True...")
        buttons = page.query_selector_all("button")
        for btn in buttons:
            try:
                if btn.is_visible():
                    aria = (btn.get_attribute("aria-label") or "").lower()
                    txt = btn.inner_text().strip().lower()
                    if any(w in aria+txt for w in ["zaakceptuj", "accept all", "accepter", "aceptar"]):
                        btn.click(no_wait_after=True, timeout=5000)
                        print(f"  Clicked: {aria!r}")
                        break
            except Exception as e:
                print(f"  Error: {e}")
        
        # Poll for URL change
        print("  Waiting for redirect...")
        for i in range(20):
            time.sleep(1)
            current = page.url
            if "maps.google" in current or "/maps/" in current:
                print(f"  Redirected after {i+1}s: {current[:80]}")
                break
            if i % 5 == 0:
                print(f"  Still waiting... ({i+1}s) URL: {current[:60]}")
    
    time.sleep(3)
    print(f"Final URL: {page.url[:80]}")
    
    links = page.eval_on_selector_all('a[href*="/maps/place/"]', "els => els.map(el => el.href)")
    print(f"Place links: {len(links)}")
    for l in links[:3]:
        print(f"  {l[:80]}")
    
    browser.close()
    print("DONE")
