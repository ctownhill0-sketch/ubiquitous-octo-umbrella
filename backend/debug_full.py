"""Full pipeline debug — consent → maps load → collect links → extract one listing."""
import time, random, requests, re
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

    print("Step 1: Navigate to Google Maps search...")
    page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(3)
    print(f"  URL: {page.url[:80]}")

    # Step 2: Handle consent
    if "consent.google.com" in page.url:
        print("Step 2: Consent page — clicking accept...")
        buttons = page.query_selector_all("button")
        for btn in buttons:
            try:
                if btn.is_visible():
                    aria = (btn.get_attribute("aria-label") or "").lower()
                    txt = btn.inner_text().strip().lower()
                    if any(w in aria+txt for w in ["zaakceptuj", "accept all", "accepter", "aceptar", "alle akzeptieren"]):
                        btn.click()
                        print(f"  Clicked: {aria or txt}")
                        break
            except Exception:
                pass
        # Wait for redirect to complete
        print("  Waiting for redirect to Google Maps...")
        try:
            page.wait_for_url("**/maps/**", timeout=15000)
        except Exception:
            pass
        time.sleep(4)
        print(f"  URL after consent: {page.url[:80]}")
    else:
        print("Step 2: No consent page needed")

    # Step 3: Wait for results to load
    print("Step 3: Waiting for results feed...")
    feed_found = False
    for sel in ['div[role="feed"]', 'div.m6QErb', 'div[aria-label*="result"]', 'div[aria-label*="Results"]']:
        try:
            page.wait_for_selector(sel, timeout=12000)
            print(f"  Feed found: {sel}")
            feed_found = True
            break
        except Exception:
            print(f"  Not found: {sel}")

    # Step 4: Collect place links
    print("Step 4: Collecting place links...")
    time.sleep(2)
    links = page.eval_on_selector_all(
        'a[href*="/maps/place/"]',
        "els => els.map(el => el.href)"
    )
    seen, unique = set(), []
    for l in links:
        if l not in seen:
            seen.add(l)
            unique.append(l)
    print(f"  Found {len(unique)} unique place links")
    for l in unique[:3]:
        print(f"    {l[:80]}")

    # Step 5: Extract one listing
    if unique:
        print(f"\nStep 5: Extracting first listing...")
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
        
        website = ""
        try:
            a = page.query_selector('a[data-item-id*="authority"]')
            if a: website = a.get_attribute("href") or ""
        except Exception: pass
        
        print(f"  Name: {name}")
        print(f"  Phone: {phone}")
        print(f"  Website: {website}")
        print("SUCCESS: Full pipeline works!")
    else:
        print("FAIL: No links found — scraping blocked or page not loaded")

    browser.close()
