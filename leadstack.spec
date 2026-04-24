# -*- mode: python ; coding: utf-8 -*-
# LeadStack™ PyInstaller spec — builds a single-file executable
# Mac: produces LeadStack.app (double-click to run)
# Windows: produces LeadStack.exe (double-click to run)

import sys
import os

block_cipher = None

# ─── Collect all backend Python files ────────────────────────────────────────
backend_dir = os.path.join(os.path.dirname(SPEC), "backend")
frontend_dist = os.path.join(os.path.dirname(SPEC), "frontend", "dist")

a = Analysis(
    [os.path.join(backend_dir, "server.py")],
    pathex=[backend_dir],
    binaries=[],
    datas=[
        # Bundle the built React frontend
        (frontend_dist, "frontend/dist"),
        # Bundle all backend modules
        (os.path.join(backend_dir, "*.py"), "backend"),
    ],
    hiddenimports=[
        "flask",
        "flask_cors",
        "anthropic",
        "google.auth",
        "google.oauth2",
        "google.oauth2.credentials",
        "google_auth_oauthlib",
        "googleapiclient",
        "googleapiclient.discovery",
        "google.auth.transport.requests",
        "requests",
        "bs4",
        "selenium",
        "playwright",
        "playwright.sync_api",
        "sqlite3",
        "smtplib",
        "imaplib",
        "email",
        "email.mime",
        "email.mime.text",
        "email.mime.multipart",
        "email.utils",
        "dns",
        "dns.resolver",
        "dnspython",
        "cryptography",
        "certifi",
        "charset_normalizer",
        "idna",
        "urllib3",
        "werkzeug",
        "jinja2",
        "click",
        "itsdangerous",
        "markupsafe",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas", "PIL"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="LeadStack",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No terminal window on Windows
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(os.path.dirname(SPEC), "assets", "icon.icns") if sys.platform == "darwin" else os.path.join(os.path.dirname(SPEC), "assets", "icon.ico"),
)

# Mac: wrap in .app bundle
if sys.platform == "darwin":
    app = BUNDLE(
        exe,
        name="LeadStack.app",
        icon=os.path.join(os.path.dirname(SPEC), "assets", "icon.icns"),
        bundle_identifier="com.leadstack.app",
        info_plist={
            "NSHighResolutionCapable": True,
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "16",
            "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True},
            "LSUIElement": False,
        },
    )
