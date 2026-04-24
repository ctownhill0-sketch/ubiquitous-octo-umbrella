"""Test consent click with expect_navigation to avoid blocking."""
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
        print("Consent page found. Clicking accept with expect_navigation...")
        buttons = page.query_selector_all("button")
        accept_btn = None
        for btn in buttons:
            try:
                if btn.is_visible():
                    aria = (btn.get_attribute("aria-label") or "").lower()
                    txt = btn.inner_text().strip().lower()
                    combined = aria + " " + txt
                    if any(w in combined for w in ["zaakceptuj", "accept all", "accepter", "aceptar"]):
                        accept_btn = btn
                        print(f"  Found accept button: aria={aria!r}")
                        break
            except Exception:
                pass
        
        if accept_btn:
            # Use expect_navigation to handle the redirect properly
            with page.expect_navigation(timeout=15000):
                accept_btn.click()
            print(f"Navigation complete. URL: {page.url[:80]}")
        else:
            print("No accept button found!")
    
    time.sleep(3)
    print(f"Final URL: {page.url[:80]}")
    
    # Check for place links
    links = page.eval_on_selector_all('a[href*="/maps/place/"]', "els => els.map(el => el.href)")
    print(f"Place links: {len(links)}")
    for l in links[:3]:
        print(f"  {l[:80]}")
    
    browser.close()
    print("DONE")
