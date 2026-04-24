"""
LeadStack™ — Desktop App
Fully rebuilt: SaaS-grade UI, Python 3.14 safe, working scraper.
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import threading
import queue
import os
import sys
import csv
import json
from datetime import datetime

# ── Palette ───────────────────────────────────────────────────────────────────
BG      = "#0D0D14"
SURFACE = "#13131E"
CARD    = "#1A1A2E"
BORDER  = "#252540"
ACCENT  = "#6C63FF"
ACCENT2 = "#8B85FF"
GREEN   = "#00D4AA"
ORANGE  = "#FF9F43"
RED     = "#FF6B6B"
HOT     = "#FF7043"
TEXT1   = "#EAEAF5"
TEXT2   = "#8888AA"
TEXT3   = "#4A4A6A"
FONT    = "Segoe UI"

STATUS_COLORS = {
    "New":            TEXT2,
    "Emailed":        ACCENT2,
    "Follow-Up Sent": ORANGE,
    "Hot Lead":       HOT,
    "Meeting Booked": GREEN,
    "Not Interested": TEXT3,
    "Unsubscribed":   TEXT3,
    "Closed - Won":   GREEN,
}

# ── Reusable Widgets ──────────────────────────────────────────────────────────

class Btn(tk.Label):
    """Flat button — no Canvas, Python 3.14 safe."""
    def __init__(self, master, text, cmd=None, accent=True,
                 pad_x=14, pad_y=8, font_size=9, **kw):
        bg = ACCENT if accent else CARD
        super().__init__(master, text=text, bg=bg, fg=TEXT1,
                         font=(FONT, font_size, "bold"),
                         cursor="hand2", padx=pad_x, pady=pad_y,
                         relief="flat", anchor="center", **kw)
        self._bg_n = bg
        self._bg_h = ACCENT2 if accent else "#22223A"
        self._cmd  = cmd
        self._on   = True
        self.bind("<Enter>",    self._hover)
        self.bind("<Leave>",    self._leave)
        self.bind("<Button-1>", self._click)

    def _hover(self, _=None):
        if self._on: self.config(bg=self._bg_h)
    def _leave(self, _=None):
        if self._on: self.config(bg=self._bg_n)
    def _click(self, _=None):
        if self._on and self._cmd: self._cmd()
    def enable(self):
        self._on = True
        self.config(bg=self._bg_n, cursor="hand2")
    def disable(self):
        self._on = False
        self.config(bg=TEXT3, cursor="")
    def set_text(self, t): self.config(text=t)


class Card(tk.Frame):
    """Bordered card frame."""
    def __init__(self, master, **kw):
        super().__init__(master, bg=CARD,
                         highlightbackground=BORDER,
                         highlightthickness=1, **kw)


class StatPill(tk.Frame):
    """Stat display pill — icon + value + label."""
    def __init__(self, master, label, icon, color, **kw):
        super().__init__(master, bg=CARD,
                         highlightbackground=color,
                         highlightthickness=1,
                         padx=16, pady=10, **kw)
        tk.Label(self, text=icon, bg=CARD, fg=color,
                 font=(FONT, 16)).grid(row=0, column=0, rowspan=2,
                                       padx=(0, 10), sticky="w")
        self._val = tk.Label(self, text="0", bg=CARD, fg=color,
                             font=(FONT, 20, "bold"))
        self._val.grid(row=0, column=1, sticky="w")
        tk.Label(self, text=label, bg=CARD, fg=TEXT2,
                 font=(FONT, 8)).grid(row=1, column=1, sticky="w")

    def set(self, v): self._val.config(text=str(v))


class Divider(tk.Frame):
    def __init__(self, master, **kw):
        super().__init__(master, bg=BORDER, height=1, **kw)


class SectionHeader(tk.Label):
    def __init__(self, master, text, **kw):
        super().__init__(master, text=text.upper(), bg=SURFACE,
                         fg=ACCENT, font=(FONT, 8, "bold"),
                         padx=0, pady=6, **kw)


class FieldLabel(tk.Label):
    def __init__(self, master, text, **kw):
        super().__init__(master, text=text, bg=SURFACE,
                         fg=TEXT2, font=(FONT, 9), **kw)


class StyledEntry(tk.Entry):
    def __init__(self, master, var=None, show=None, **kw):
        kwargs = dict(bg=CARD, fg=TEXT1, insertbackground=TEXT1,
                      relief="flat", font=(FONT, 10),
                      highlightbackground=BORDER, highlightthickness=1,
                      bd=6)
        kwargs.update(kw)
        if show:
            kwargs["show"] = show
        if var:
            super().__init__(master, textvariable=var, **kwargs)
        else:
            super().__init__(master, **kwargs)


class LogBox(tk.Frame):
    """Styled log text box."""
    def __init__(self, master, **kw):
        super().__init__(master, bg=CARD,
                         highlightbackground=BORDER,
                         highlightthickness=1, **kw)
        self._txt = tk.Text(self, bg=CARD, fg=TEXT2,
                            insertbackground=TEXT1,
                            relief="flat", font=("Courier New", 9),
                            state="disabled", wrap="word", bd=8)
        vsb = ttk.Scrollbar(self, orient="vertical",
                             command=self._txt.yview)
        self._txt.configure(yscrollcommand=vsb.set)
        self._txt.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        for tag, color in [("success", GREEN), ("error", RED),
                            ("warn", ORANGE), ("hot", HOT),
                            ("info", TEXT2), ("accent", ACCENT2)]:
            self._txt.tag_config(tag, foreground=color)

    def log(self, msg: str, level: str = "info"):
        ts = datetime.now().strftime("%H:%M:%S")
        self._txt.config(state="normal")
        self._txt.insert("end", f"[{ts}] {msg}\n", level)
        self._txt.see("end")
        self._txt.config(state="disabled")

    def clear(self):
        self._txt.config(state="normal")
        self._txt.delete("1.0", "end")
        self._txt.config(state="disabled")


# ── Main App ──────────────────────────────────────────────────────────────────

class MoneyMachineApp(tk.Tk):

    TAB_ICONS = ["🔍", "📧", "🔄", "💬", "📊", "⚙"]
    TAB_NAMES = ["Scraper", "Email Sender", "Follow-Ups",
                 "Reply Monitor", "Daily Report", "Settings"]

    def __init__(self):
        super().__init__()
        self.title("LeadStack™")
        self.geometry("1340x840")
        self.minsize(1100, 720)
        self.configure(bg=BG)
        self._q        = queue.Queue()
        self._db       = None
        self._gmail    = None
        self._writer   = None
        self._auto     = None
        self._scraping = False
        self._active_tab = 0

        self._init_db()
        self._apply_styles()
        self._build_header()
        self._build_stats_bar()
        self._build_tab_bar()
        self._build_content()
        self._switch_tab(0)
        self._refresh_stats()
        self._poll_queue()
        self._try_init_engines()

    # ── Styles ────────────────────────────────────────────────────────────────
    def _apply_styles(self):
        s = ttk.Style()
        s.theme_use("clam")
        s.configure("Treeview",
                     background=CARD, foreground=TEXT1,
                     fieldbackground=CARD, rowheight=38,
                     borderwidth=0, font=(FONT, 9))
        s.configure("Treeview.Heading",
                     background=SURFACE, foreground=TEXT2,
                     font=(FONT, 8, "bold"), relief="flat", borderwidth=0)
        s.map("Treeview",
              background=[("selected", "#2A2A50")],
              foreground=[("selected", TEXT1)])
        s.configure("TProgressbar",
                     troughcolor=CARD, background=ACCENT,
                     borderwidth=0, thickness=4)
        s.configure("TScrollbar",
                     background=SURFACE, troughcolor=CARD,
                     borderwidth=0, arrowcolor=TEXT3)
        s.configure("TCombobox",
                     fieldbackground=CARD, background=CARD,
                     foreground=TEXT1, selectbackground=ACCENT,
                     borderwidth=0)
        s.map("TCombobox",
              fieldbackground=[("readonly", CARD)],
              foreground=[("readonly", TEXT1)])

    # ── DB Init ───────────────────────────────────────────────────────────────
    def _init_db(self):
        try:
            from database import Database
            self._db = Database()
        except Exception as e:
            messagebox.showerror("Fatal Error", f"Database failed to init:\n{e}")
            sys.exit(1)

    def _try_init_engines(self):
        try:
            from gmail_engine import GmailEngine
            self._gmail = GmailEngine(
                on_log=self._enqueue_log,
                on_reply_detected=self._on_hot_lead
            )
        except Exception as e:
            self._enqueue_log(f"Gmail engine: {e}", "warn")
        self._try_init_writer()

    def _try_init_writer(self):
        key = self._db.get_setting("claude_api_key", "")
        if not key:
            return
        try:
            from email_writer import EmailWriter
            self._writer = EmailWriter(
                api_key=key,
                sender_name=self._db.get_setting("sender_name", "Your Name"),
                sender_title=self._db.get_setting("sender_title", "Founder, LeadStack™"),
                sender_phone=self._db.get_setting("sender_phone", ""),
            )
        except Exception as e:
            self._enqueue_log(f"Email writer: {e}", "warn")
            return
        try:
            from automation import AutomationEngine
            try:
                from scraper import GoogleMapsScraper as SC
            except Exception:
                SC = None
            self._auto = AutomationEngine(
                db=self._db, gmail_engine=self._gmail,
                email_writer=self._writer, scraper_cls=SC,
                on_log=self._enqueue_log,
                on_stats_update=self._refresh_stats,
            )
        except Exception as e:
            self._enqueue_log(f"Automation engine: {e}", "warn")

    # ── Header ────────────────────────────────────────────────────────────────
    def _build_header(self):
        hdr = tk.Frame(self, bg=SURFACE, height=56)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)

        # Logo area
        logo = tk.Frame(hdr, bg=SURFACE)
        logo.pack(side="left", padx=20, pady=8)
        tk.Label(logo, text="💰", bg=SURFACE, fg=ACCENT,
                 font=(FONT, 18)).pack(side="left")
        name_f = tk.Frame(logo, bg=SURFACE)
        name_f.pack(side="left", padx=8)
        tk.Label(name_f, text="LeadStack™", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 13, "bold")).pack(anchor="w")
        tk.Label(name_f, text="Money Machine", bg=SURFACE, fg=TEXT2,
                 font=(FONT, 8)).pack(anchor="w")

        Divider(hdr).pack(side="left", fill="y", pady=10)

        # Status
        right = tk.Frame(hdr, bg=SURFACE)
        right.pack(side="right", padx=20)
        self._machine_dot = tk.Label(right, text="●", bg=SURFACE, fg=RED,
                                     font=(FONT, 10))
        self._machine_dot.pack(side="left")
        self._machine_lbl = tk.Label(right, text="STOPPED", bg=SURFACE, fg=RED,
                                     font=(FONT, 9, "bold"))
        self._machine_lbl.pack(side="left", padx=(4, 16))

        Btn(right, "🚀  START", cmd=self._start_machine,
            font_size=9).pack(side="left", padx=3)
        Btn(right, "⏹  STOP", cmd=self._stop_machine,
            accent=False, font_size=9).pack(side="left", padx=3)

    # ── Stats Bar ─────────────────────────────────────────────────────────────
    def _build_stats_bar(self):
        bar = tk.Frame(self, bg=BG)
        bar.pack(fill="x", padx=14, pady=(10, 0))
        defs = [
            ("Total Leads",  "👥", ACCENT),
            ("With Email",   "📧", GREEN),
            ("Emails Sent",  "📤", ORANGE),
            ("Replies",      "💬", HOT),
            ("Hot Leads",    "🔥", RED),
            ("Meetings",     "🤝", GREEN),
        ]
        self._pills = {}
        for label, icon, color in defs:
            p = StatPill(bar, label, icon, color)
            p.pack(side="left", padx=5, pady=4, ipadx=4, ipady=2)
            self._pills[label] = p

    # ── Tab Bar ───────────────────────────────────────────────────────────────
    def _build_tab_bar(self):
        self._tab_bar = tk.Frame(self, bg=SURFACE, height=46)
        self._tab_bar.pack(fill="x", pady=(10, 0))
        self._tab_bar.pack_propagate(False)
        self._tab_btns = []
        for i, (icon, name) in enumerate(zip(self.TAB_ICONS, self.TAB_NAMES)):
            btn = tk.Label(self._tab_bar,
                           text=f"  {icon}  {name}  ",
                           bg=SURFACE, fg=TEXT2,
                           font=(FONT, 10), cursor="hand2",
                           pady=12)
            btn.pack(side="left")
            btn.bind("<Button-1>", lambda e, idx=i: self._switch_tab(idx))
            btn.bind("<Enter>",    lambda e, b=btn: b.config(fg=TEXT1) if b.cget("bg") != ACCENT else None)
            btn.bind("<Leave>",    lambda e, b=btn, idx=i: b.config(fg=TEXT2) if self._active_tab != idx else None)
            self._tab_btns.append(btn)

    def _switch_tab(self, idx: int):
        self._active_tab = idx
        for i, btn in enumerate(self._tab_btns):
            if i == idx:
                btn.config(bg=ACCENT, fg=TEXT1)
            else:
                btn.config(bg=SURFACE, fg=TEXT2)
        for i, frame in enumerate(self._tab_frames):
            if i == idx:
                frame.pack(fill="both", expand=True)
            else:
                frame.pack_forget()

    # ── Content ───────────────────────────────────────────────────────────────
    def _build_content(self):
        self._content = tk.Frame(self, bg=BG)
        self._content.pack(fill="both", expand=True)
        self._tab_frames = []
        builders = [
            self._build_scraper_tab,
            self._build_email_tab,
            self._build_followup_tab,
            self._build_reply_tab,
            self._build_report_tab,
            self._build_settings_tab,
        ]
        for builder in builders:
            f = tk.Frame(self._content, bg=BG)
            self._tab_frames.append(f)
            builder(f)

    # ═══════════════════════════════════════════════════════════════════════════
    # TAB 1 — SCRAPER
    # ═══════════════════════════════════════════════════════════════════════════
    def _build_scraper_tab(self, tab):
        # Left sidebar
        sb = tk.Frame(tab, bg=SURFACE, width=260)
        sb.pack(side="left", fill="y", padx=(10, 0), pady=10)
        sb.pack_propagate(False)

        tk.Label(sb, text="🔍  Auto Scraper", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", padx=16, pady=(16, 2))
        tk.Label(sb, text="Scrapes fresh leads from Google Maps\nand extracts emails from their websites.",
                 bg=SURFACE, fg=TEXT2, font=(FONT, 9),
                 justify="left").pack(anchor="w", padx=16, pady=(0, 12))

        Divider(sb).pack(fill="x", padx=16, pady=4)
        SectionHeader(sb, "Manual Search").pack(anchor="w", padx=16)

        FieldLabel(sb, "Keyword").pack(anchor="w", padx=16, pady=(4, 0))
        self._s_kw = StyledEntry(sb)
        self._s_kw.insert(0, "independent financial advisor")
        self._s_kw.pack(fill="x", padx=16, pady=(2, 8))

        FieldLabel(sb, "City").pack(anchor="w", padx=16, pady=(0, 0))
        self._s_city = StyledEntry(sb)
        self._s_city.insert(0, "New York, NY")
        self._s_city.pack(fill="x", padx=16, pady=(2, 8))

        FieldLabel(sb, "Max Results").pack(anchor="w", padx=16)
        self._s_max = StyledEntry(sb)
        self._s_max.insert(0, "20")
        self._s_max.pack(fill="x", padx=16, pady=(2, 12))

        self._scrape_btn = Btn(sb, "🔍  Search & Scrape",
                               cmd=self._do_scrape, font_size=10)
        self._scrape_btn.pack(fill="x", padx=16, pady=4)

        Divider(sb).pack(fill="x", padx=16, pady=10)

        Btn(sb, "⬇  Export CSV",   cmd=self._export_csv,
            accent=False).pack(fill="x", padx=16, pady=3)
        Btn(sb, "⬇  Export Excel", cmd=self._export_excel,
            accent=False).pack(fill="x", padx=16, pady=3)

        Divider(sb).pack(fill="x", padx=16, pady=10)

        self._scrape_prog = ttk.Progressbar(sb, mode="indeterminate")
        self._scrape_prog.pack(fill="x", padx=16, pady=(0, 4))
        self._scrape_lbl = tk.Label(sb, text="Ready", bg=SURFACE, fg=TEXT2,
                                    font=(FONT, 8), wraplength=220, justify="left")
        self._scrape_lbl.pack(anchor="w", padx=16)

        # Right — table + log
        right = tk.Frame(tab, bg=BG)
        right.pack(side="left", fill="both", expand=True,
                   padx=10, pady=10)

        # Table header row
        th = tk.Frame(right, bg=BG)
        th.pack(fill="x", pady=(0, 6))
        tk.Label(th, text="Lead Database", bg=BG, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(side="left")
        self._lead_count_lbl = tk.Label(th, text="0 leads", bg=BG, fg=TEXT2,
                                        font=(FONT, 9))
        self._lead_count_lbl.pack(side="right")

        # Filter row
        fr = tk.Frame(right, bg=BG)
        fr.pack(fill="x", pady=(0, 6))
        tk.Label(fr, text="Filter:", bg=BG, fg=TEXT2,
                 font=(FONT, 9)).pack(side="left")
        self._filter_var = tk.StringVar()
        fe = StyledEntry(fr, var=self._filter_var)
        fe.pack(side="left", padx=8, fill="x", expand=True)
        self._filter_var.trace_add("write", lambda *_: self._load_leads())
        Btn(fr, "Clear", cmd=lambda: self._filter_var.set(""),
            accent=False, pad_x=8, pad_y=4,
            font_size=8).pack(side="left")

        # Leads table
        tbl_frame = Card(right)
        tbl_frame.pack(fill="both", expand=True)
        cols = ("Score", "Name", "City", "Phone", "Email", "Rating", "Status", "Created")
        self._tree = ttk.Treeview(tbl_frame, columns=cols,
                                  show="headings", selectmode="browse")
        widths = {"Score": 50, "Name": 220, "City": 110, "Phone": 130,
                  "Email": 190, "Rating": 60, "Status": 115, "Created": 90}
        for col in cols:
            self._tree.heading(col, text=col,
                               command=lambda c=col: self._sort_tree(c))
            self._tree.column(col, width=widths.get(col, 100), minwidth=40)
        vsb = ttk.Scrollbar(tbl_frame, orient="vertical",
                             command=self._tree.yview)
        hsb = ttk.Scrollbar(tbl_frame, orient="horizontal",
                             command=self._tree.xview)
        self._tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        self._tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        self._tree.tag_configure("hot",     background="#2A1A10")
        self._tree.tag_configure("meeting", background="#0A2A1A")
        self._tree.tag_configure("emailed", background="#1A1A30")
        self._tree.tag_configure("normal",  background=CARD)

        self._tree.bind("<Double-1>", self._on_lead_double_click)

        # Log below table
        tk.Label(right, text="Activity Log", bg=BG, fg=TEXT2,
                 font=(FONT, 9, "bold")).pack(anchor="w", pady=(8, 2))
        self._scrape_log = LogBox(right, height=120)
        self._scrape_log.pack(fill="x")

        self._load_leads()

    def _sort_tree(self, col):
        """Sort treeview by column."""
        data = [(self._tree.set(k, col), k) for k in self._tree.get_children("")]
        try:
            data.sort(key=lambda x: float(x[0]) if x[0] else 0, reverse=True)
        except ValueError:
            data.sort(key=lambda x: x[0].lower())
        for i, (_, k) in enumerate(data):
            self._tree.move(k, "", i)

    def _on_lead_double_click(self, event):
        sel = self._tree.selection()
        if not sel:
            return
        vals = self._tree.item(sel[0], "values")
        if not vals:
            return
        self._show_lead_detail(vals)

    def _show_lead_detail(self, vals):
        win = tk.Toplevel(self)
        win.title("Lead Details")
        win.configure(bg=SURFACE)
        win.geometry("480x420")
        labels = ["Score", "Name", "City", "Phone", "Email",
                  "Rating", "Status", "Created"]
        for i, (lbl, val) in enumerate(zip(labels, vals)):
            tk.Label(win, text=f"{lbl}:", bg=SURFACE, fg=TEXT2,
                     font=(FONT, 9, "bold"), width=12,
                     anchor="e").grid(row=i, column=0, padx=16, pady=4, sticky="e")
            tk.Label(win, text=val, bg=SURFACE, fg=TEXT1,
                     font=(FONT, 9)).grid(row=i, column=1, padx=8, pady=4, sticky="w")
        Btn(win, "Close", cmd=win.destroy).grid(
            row=len(labels)+1, column=0, columnspan=2, pady=16)

    # ═══════════════════════════════════════════════════════════════════════════
    # TAB 2 — EMAIL SENDER
    # ═══════════════════════════════════════════════════════════════════════════
    def _build_email_tab(self, tab):
        sb = tk.Frame(tab, bg=SURFACE, width=280)
        sb.pack(side="left", fill="y", padx=(10, 0), pady=10)
        sb.pack_propagate(False)

        tk.Label(sb, text="📧  Email Sender", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", padx=16, pady=(16, 2))
        tk.Label(sb, text="Sends AI-personalised cold emails\nto all new leads automatically.",
                 bg=SURFACE, fg=TEXT2, font=(FONT, 9),
                 justify="left").pack(anchor="w", padx=16, pady=(0, 12))

        Divider(sb).pack(fill="x", padx=16, pady=4)

        self._gmail_lbl = tk.Label(sb, text="● Gmail: Not Connected",
                                   bg=SURFACE, fg=RED,
                                   font=(FONT, 10, "bold"))
        self._gmail_lbl.pack(anchor="w", padx=16, pady=(10, 6))

        Btn(sb, "🔗  Connect Gmail",
            cmd=self._connect_gmail).pack(fill="x", padx=16, pady=4)

        Divider(sb).pack(fill="x", padx=16, pady=10)
        SectionHeader(sb, "Send Settings").pack(anchor="w", padx=16)

        FieldLabel(sb, "Daily Email Limit").pack(anchor="w", padx=16, pady=(6, 0))
        self._limit_var = tk.StringVar(
            value=self._db.get_setting("daily_email_limit", "40"))
        StyledEntry(sb, var=self._limit_var).pack(fill="x", padx=16, pady=(2, 8))

        self._ai_var = tk.BooleanVar(value=True)
        tk.Checkbutton(sb, text="  AI personalisation (Claude)",
                       variable=self._ai_var, bg=SURFACE, fg=TEXT1,
                       selectcolor=CARD, activebackground=SURFACE,
                       font=(FONT, 9)).pack(anchor="w", padx=16, pady=4)

        Divider(sb).pack(fill="x", padx=16, pady=10)

        self._send_btn = Btn(sb, "📧  Send Emails Now",
                             cmd=self._send_emails, font_size=10)
        self._send_btn.pack(fill="x", padx=16, pady=4)

        self._email_prog = ttk.Progressbar(sb, mode="determinate")
        self._email_prog.pack(fill="x", padx=16, pady=8)
        self._email_status = tk.Label(sb, text="Ready", bg=SURFACE, fg=TEXT2,
                                      font=(FONT, 8))
        self._email_status.pack(anchor="w", padx=16)

        right = tk.Frame(tab, bg=BG)
        right.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        tk.Label(right, text="Email Activity Log", bg=BG, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", pady=(0, 6))
        self._email_log = LogBox(right)
        self._email_log.pack(fill="both", expand=True)

    # ═══════════════════════════════════════════════════════════════════════════
    # TAB 3 — FOLLOW-UPS
    # ═══════════════════════════════════════════════════════════════════════════
    def _build_followup_tab(self, tab):
        sb = tk.Frame(tab, bg=SURFACE, width=280)
        sb.pack(side="left", fill="y", padx=(10, 0), pady=10)
        sb.pack_propagate(False)

        tk.Label(sb, text="🔄  Follow-Up Engine", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", padx=16, pady=(16, 2))
        tk.Label(sb, text="Auto follow-ups to non-responders.\n"
                          "Day 3: Follow-up  |  Day 7: Breakup",
                 bg=SURFACE, fg=TEXT2, font=(FONT, 9),
                 justify="left").pack(anchor="w", padx=16, pady=(0, 12))

        Divider(sb).pack(fill="x", padx=16, pady=4)

        self._fu_pending_lbl = tk.Label(sb, text="Pending: 0",
                                        bg=SURFACE, fg=ORANGE,
                                        font=(FONT, 14, "bold"))
        self._fu_pending_lbl.pack(anchor="w", padx=16, pady=(12, 4))

        Btn(sb, "⚡  Run Follow-Ups Now",
            cmd=lambda: self._run_engine(3)).pack(fill="x", padx=16, pady=6)

        right = tk.Frame(tab, bg=BG)
        right.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        tk.Label(right, text="Follow-Up Log", bg=BG, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", pady=(0, 6))
        self._fu_log = LogBox(right)
        self._fu_log.pack(fill="both", expand=True)

    # ═══════════════════════════════════════════════════════════════════════════
    # TAB 4 — REPLY MONITOR
    # ═══════════════════════════════════════════════════════════════════════════
    def _build_reply_tab(self, tab):
        sb = tk.Frame(tab, bg=SURFACE, width=280)
        sb.pack(side="left", fill="y", padx=(10, 0), pady=10)
        sb.pack_propagate(False)

        tk.Label(sb, text="💬  Reply Monitor", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", padx=16, pady=(16, 2))
        tk.Label(sb, text="Checks inbox every hour.\nDetects hot leads and alerts you instantly.",
                 bg=SURFACE, fg=TEXT2, font=(FONT, 9),
                 justify="left").pack(anchor="w", padx=16, pady=(0, 12))

        Divider(sb).pack(fill="x", padx=16, pady=4)

        self._hot_lbl = tk.Label(sb, text="🔥  Hot Leads: 0",
                                 bg=SURFACE, fg=HOT,
                                 font=(FONT, 16, "bold"))
        self._hot_lbl.pack(anchor="w", padx=16, pady=(12, 4))

        Btn(sb, "🔍  Check Replies Now",
            cmd=lambda: self._run_engine(4)).pack(fill="x", padx=16, pady=6)

        Divider(sb).pack(fill="x", padx=16, pady=8)

        tk.Label(sb, text="Hot Leads — Call Now", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 10, "bold")).pack(anchor="w", padx=16, pady=(4, 4))
        self._hot_list = tk.Listbox(sb, bg=CARD, fg=HOT,
                                    selectbackground="#3A2010",
                                    relief="flat", font=(FONT, 9),
                                    borderwidth=0, highlightthickness=1,
                                    highlightbackground=BORDER)
        self._hot_list.pack(fill="both", expand=True, padx=16, pady=4)

        right = tk.Frame(tab, bg=BG)
        right.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        tk.Label(right, text="Reply Monitor Log", bg=BG, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", pady=(0, 6))
        self._reply_log = LogBox(right)
        self._reply_log.pack(fill="both", expand=True)

    # ═══════════════════════════════════════════════════════════════════════════
    # TAB 5 — DAILY REPORT
    # ═══════════════════════════════════════════════════════════════════════════
    def _build_report_tab(self, tab):
        sb = tk.Frame(tab, bg=SURFACE, width=280)
        sb.pack(side="left", fill="y", padx=(10, 0), pady=10)
        sb.pack_propagate(False)

        tk.Label(sb, text="📊  Daily Report", bg=SURFACE, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", padx=16, pady=(16, 2))
        tk.Label(sb, text="Emails you a full stats summary\nevery morning at 9am.",
                 bg=SURFACE, fg=TEXT2, font=(FONT, 9),
                 justify="left").pack(anchor="w", padx=16, pady=(0, 12))

        Divider(sb).pack(fill="x", padx=16, pady=4)

        FieldLabel(sb, "Report Email Address").pack(anchor="w", padx=16, pady=(8, 0))
        self._report_email_var = tk.StringVar(
            value=self._db.get_setting("report_email", ""))
        StyledEntry(sb, var=self._report_email_var).pack(
            fill="x", padx=16, pady=(2, 10))

        Btn(sb, "📊  Send Report Now",
            cmd=lambda: self._run_engine(5)).pack(fill="x", padx=16, pady=4)

        Divider(sb).pack(fill="x", padx=16, pady=12)

        # Today's stats summary
        SectionHeader(sb, "Today's Stats").pack(anchor="w", padx=16)
        self._today_stats_lbl = tk.Label(sb, text="Loading...",
                                         bg=SURFACE, fg=TEXT2,
                                         font=("Courier New", 9),
                                         justify="left")
        self._today_stats_lbl.pack(anchor="w", padx=16, pady=6)

        Btn(sb, "🔄  Refresh Stats",
            cmd=self._refresh_stats, accent=False).pack(
            fill="x", padx=16, pady=4)

        right = tk.Frame(tab, bg=BG)
        right.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        tk.Label(right, text="Automation Log", bg=BG, fg=TEXT1,
                 font=(FONT, 12, "bold")).pack(anchor="w", pady=(0, 6))
        self._report_log = LogBox(right)
        self._report_log.pack(fill="both", expand=True)

    # ═══════════════════════════════════════════════════════════════════════════
    # TAB 6 — SETTINGS
    # ═══════════════════════════════════════════════════════════════════════════
    def _build_settings_tab(self, tab):
        # Scrollable container
        outer = tk.Frame(tab, bg=BG)
        outer.pack(fill="both", expand=True, padx=10, pady=10)

        canvas = tk.Canvas(outer, bg=BG, highlightthickness=0)
        vsb = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        inner = tk.Frame(canvas, bg=BG)
        win_id = canvas.create_window((0, 0), window=inner, anchor="nw")

        def _resize(e):
            canvas.configure(scrollregion=canvas.bbox("all"))
        def _fit(e):
            canvas.itemconfig(win_id, width=e.width)
        inner.bind("<Configure>", _resize)
        canvas.bind("<Configure>", _fit)

        # Bind mousewheel
        def _scroll(e):
            canvas.yview_scroll(int(-1*(e.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", _scroll)

        col1 = tk.Frame(inner, bg=BG)
        col1.grid(row=0, column=0, sticky="nsew", padx=16, pady=8)
        col2 = tk.Frame(inner, bg=BG)
        col2.grid(row=0, column=1, sticky="nsew", padx=16, pady=8)
        inner.columnconfigure(0, weight=1)
        inner.columnconfigure(1, weight=1)

        self._sv = {}  # settings vars

        def sec(parent, title):
            tk.Label(parent, text=title, bg=BG, fg=ACCENT,
                     font=(FONT, 11, "bold")).pack(anchor="w", pady=(16, 2))
            Divider(parent).pack(fill="x", pady=(0, 8))

        def fld(parent, label, key, default="", show=None, height=None):
            tk.Label(parent, text=label, bg=BG, fg=TEXT2,
                     font=(FONT, 9)).pack(anchor="w", pady=(4, 0))
            if height:
                w = tk.Text(parent, bg=CARD, fg=TEXT1,
                            insertbackground=TEXT1, relief="flat",
                            font=(FONT, 9), height=height, bd=6,
                            highlightbackground=BORDER, highlightthickness=1)
                w.insert("1.0", self._db.get_setting(key, default))
                w.pack(fill="x", pady=(2, 6))
                self._sv[key] = w
            else:
                var = tk.StringVar(value=self._db.get_setting(key, default))
                kw = {"show": show} if show else {}
                StyledEntry(parent, var=var, **kw).pack(fill="x", pady=(2, 6))
                self._sv[key] = var

        # Column 1
        sec(col1, "🔑  API Keys")
        fld(col1, "Claude API Key (console.anthropic.com)",
            "claude_api_key", show="*")
        fld(col1, "Gmail OAuth Client ID", "gmail_client_id")
        fld(col1, "Gmail OAuth Client Secret", "gmail_client_secret")

        sec(col1, "👤  Your Identity")
        fld(col1, "Your Full Name", "sender_name", "Your Name")
        fld(col1, "Your Title", "sender_title", "Founder, LeadStack™")
        fld(col1, "Your Phone Number", "sender_phone", "")
        fld(col1, "Report Email Address", "report_email", "")

        sec(col1, "⏰  Automation Schedule")
        fld(col1, "Scraper Hour (0-23, e.g. 2 = 2am)", "scrape_hour", "2")
        fld(col1, "Email Send Hour (0-23, e.g. 8 = 8am)", "email_hour", "8")
        fld(col1, "Report Hour (0-23, e.g. 9 = 9am)", "report_hour", "9")
        fld(col1, "Daily Email Limit (recommended: 40-50)", "daily_email_limit", "40")
        fld(col1, "Delay Between Sends (seconds)", "send_delay_seconds", "30")

        # Column 2
        sec(col2, "🎯  Scraper Targets")
        fld(col2, "Keywords (one per line)", "keywords",
            "independent financial advisor\nfinancial planner\nwealth manager\nregistered investment advisor",
            height=5)
        fld(col2, "Cities (one per line)", "cities",
            "New York, NY\nLos Angeles, CA\nChicago, IL\nHouston, TX\n"
            "Phoenix, AZ\nPhiladelphia, PA\nSan Antonio, TX\nSan Diego, CA\n"
            "Dallas, TX\nSan Jose, CA\nAustin, TX\nJacksonville, FL",
            height=8)

        sec(col2, "✉️  Email Templates")
        fld(col2, "Step 1 Subject Line", "step1_subject",
            "Quick question about {name}'s follow-up process")
        fld(col2, "Step 2 Subject Line", "step2_subject",
            "Re: Quick question about {name}'s follow-up process")
        fld(col2, "Step 3 Subject Line", "step3_subject",
            "Closing the loop — {name}")

        # Save button
        save_row = tk.Frame(inner, bg=BG)
        save_row.grid(row=1, column=0, columnspan=2, pady=16, padx=16, sticky="w")
        Btn(save_row, "💾  Save All Settings",
            cmd=self._save_settings, font_size=11).pack(side="left")
        self._save_lbl = tk.Label(save_row, text="", bg=BG, fg=GREEN,
                                  font=(FONT, 9))
        self._save_lbl.pack(side="left", padx=12)

    # ═══════════════════════════════════════════════════════════════════════════
    # ACTIONS
    # ═══════════════════════════════════════════════════════════════════════════

    def _do_scrape(self):
        if self._scraping:
            return
        kw   = self._s_kw.get().strip()
        city = self._s_city.get().strip()
        try:
            max_r = int(self._s_max.get().strip())
        except ValueError:
            max_r = 20
        if not kw or not city:
            messagebox.showwarning("Missing Input",
                                   "Please enter a keyword and city.")
            return

        self._scraping = True
        self._scrape_btn.disable()
        self._scrape_prog.start(10)
        self._scrape_lbl.config(text=f"Searching '{kw}' in {city}...")
        self._scrape_log.log(f"Starting scrape: '{kw}' in {city} (max {max_r})", "accent")

        def on_progress(cur, total, msg):
            self.after(0, lambda: self._scrape_lbl.config(
                text=(msg or "")[:80]))
            if msg:
                self.after(0, lambda: self._scrape_log.log(msg, "info"))

        def on_lead(lead):
            self._db.upsert_lead(lead)
            name  = lead.get("name", "?")
            phone = lead.get("phone", "—")
            email = lead.get("email", "—")
            score = lead.get("lead_score", 0)
            self.after(0, lambda: self._scrape_log.log(
                f"  ✓  [{score}pts]  {name}  |  {phone}  |  {email}", "success"))
            self.after(0, self._load_leads)
            self.after(0, self._refresh_stats)

        def run():
            try:
                from scraper import GoogleMapsScraper
                scraper = GoogleMapsScraper(
                    progress_callback=on_progress,
                    lead_callback=on_lead
                )
                results = scraper.search(
                    keyword=kw, city=city,
                    max_results=max_r,
                    search_keyword=kw, search_city=city
                )
                self.after(0, lambda: self._scrape_done(len(results)))
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                self.after(0, lambda: self._scrape_fail(tb))

        threading.Thread(target=run, daemon=True).start()

    def _scrape_done(self, count):
        self._scraping = False
        self._scrape_btn.enable()
        self._scrape_prog.stop()
        self._scrape_lbl.config(text=f"✓ Done — {count} leads found")
        self._scrape_log.log(f"Scrape complete: {count} leads collected.", "success")
        self._load_leads()
        self._refresh_stats()

    def _scrape_fail(self, err):
        self._scraping = False
        self._scrape_btn.enable()
        self._scrape_prog.stop()
        short = err.split("\n")[-2] if "\n" in err else err[:80]
        self._scrape_lbl.config(text=f"Error: {short}")
        self._scrape_log.log(f"Scrape error:\n{err}", "error")

    def _connect_gmail(self):
        cid = self._db.get_setting("gmail_client_id", "")
        cs  = self._db.get_setting("gmail_client_secret", "")
        if not cid or not cs:
            messagebox.showinfo(
                "Gmail Setup Required",
                "Please go to ⚙ Settings and enter your Gmail OAuth\n"
                "Client ID and Client Secret first.\n\n"
                "Get them free at: console.cloud.google.com\n"
                "New Project → Enable Gmail API → Credentials\n"
                "→ Create OAuth 2.0 Client ID (Desktop app)"
            )
            self._switch_tab(5)
            return

        def run():
            ok = self._gmail.authenticate(cid, cs)
            self.after(0, lambda: self._gmail_result(ok))

        threading.Thread(target=run, daemon=True).start()
        self._gmail_lbl.config(text="● Connecting...", fg=ORANGE)

    def _gmail_result(self, ok):
        if ok:
            addr = self._gmail.sender_email
            self._gmail_lbl.config(text=f"● Gmail: {addr}", fg=GREEN)
            self._enqueue_log(f"Gmail connected: {addr}", "success")
        else:
            self._gmail_lbl.config(text="● Gmail: Failed", fg=RED)

    def _send_emails(self):
        if not self._gmail or not self._gmail.is_connected():
            messagebox.showwarning("Not Connected",
                                   "Please connect Gmail first (Tab 2).")
            return
        if not self._writer:
            messagebox.showwarning("No API Key",
                                   "Please add your Claude API key in ⚙ Settings.")
            return
        leads = self._db.get_leads({"has_email": True, "not_emailed": True})
        if not leads:
            messagebox.showinfo("No Leads",
                                "No new leads with email addresses to send to.\n"
                                "Scrape some leads first!")
            return
        try:
            limit = int(self._limit_var.get())
        except ValueError:
            limit = 40

        self._send_btn.disable()
        self._email_prog.config(maximum=max(len(leads), 1), value=0)

        def on_prog(i, total, sent, failed):
            self.after(0, lambda: self._email_prog.config(value=i))
            self.after(0, lambda: self._email_status.config(
                text=f"{i}/{total} — Sent: {sent}  Failed: {failed}"))

        def run():
            result = self._gmail.send_batch(
                leads, self._db, self._writer,
                daily_limit=limit,
                delay_seconds=int(self._db.get_setting("send_delay_seconds", "30")),
                on_progress=on_prog,
                use_ai=self._ai_var.get(),
            )
            self.after(0, lambda: self._send_done(result))

        threading.Thread(target=run, daemon=True).start()

    def _send_done(self, result):
        self._send_btn.enable()
        self._email_status.config(
            text=f"Done! Sent: {result['sent']}  Failed: {result['failed']}")
        self._enqueue_log(
            f"Email batch complete — Sent: {result['sent']}, "
            f"Failed: {result['failed']}", "success")
        self._refresh_stats()

    def _run_engine(self, n):
        if not self._auto:
            messagebox.showwarning(
                "Setup Required",
                "Please save your Claude API key in ⚙ Settings first.")
            return
        self._auto.run_now(n)
        self._enqueue_log(f"Engine {n} triggered manually.", "info")

    def _start_machine(self):
        if not self._writer:
            messagebox.showwarning(
                "Setup Required",
                "Please save your Claude API key in ⚙ Settings first,\n"
                "then click START again.")
            self._switch_tab(5)
            return
        if not self._auto:
            messagebox.showwarning("Setup Required",
                                   "Please save settings first.")
            return
        self._auto.start(self._db.get_all_settings())
        self._machine_dot.config(fg=GREEN)
        self._machine_lbl.config(text="RUNNING", fg=GREEN)
        self._enqueue_log("🚀 Money Machine started!", "success")

    def _stop_machine(self):
        if self._auto:
            self._auto.stop()
        self._machine_dot.config(fg=RED)
        self._machine_lbl.config(text="STOPPED", fg=RED)
        self._enqueue_log("Machine stopped.", "warn")

    def _save_settings(self):
        for key, widget in self._sv.items():
            if isinstance(widget, tk.Text):
                val = widget.get("1.0", "end").strip()
            else:
                val = widget.get().strip()
            self._db.set_setting(key, val)
        # Also save report email and daily limit from other tabs
        self._db.set_setting("report_email",
                             self._report_email_var.get().strip())
        self._db.set_setting("daily_email_limit",
                             self._limit_var.get().strip())
        self._try_init_writer()
        self._save_lbl.config(text="✓ Saved!")
        self.after(3000, lambda: self._save_lbl.config(text=""))
        self._enqueue_log("Settings saved and engines re-initialised.", "success")

    def _export_csv(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")],
            initialfile=f"leads_{datetime.now().strftime('%Y%m%d_%H%M')}.csv")
        if not path:
            return
        leads = self._db.get_leads()
        if not leads:
            messagebox.showinfo("No Data", "No leads to export yet.")
            return
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=leads[0].keys())
            w.writeheader()
            w.writerows(leads)
        messagebox.showinfo("Exported ✓",
                            f"Exported {len(leads)} leads to:\n{path}")

    def _export_excel(self):
        try:
            import pandas as pd
        except ImportError:
            messagebox.showerror("Missing Package",
                                 "Run: pip3 install pandas openpyxl")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx")],
            initialfile=f"leads_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx")
        if not path:
            return
        leads = self._db.get_leads()
        if not leads:
            messagebox.showinfo("No Data", "No leads to export yet.")
            return
        pd.DataFrame(leads).to_excel(path, index=False)
        messagebox.showinfo("Exported ✓",
                            f"Exported {len(leads)} leads to:\n{path}")

    # ═══════════════════════════════════════════════════════════════════════════
    # DATA / REFRESH
    # ═══════════════════════════════════════════════════════════════════════════

    def _load_leads(self):
        for row in self._tree.get_children():
            self._tree.delete(row)
        kw = self._filter_var.get().strip() if hasattr(self, "_filter_var") else ""
        filters = {"keyword": kw} if kw else {}
        leads = self._db.get_leads(filters)
        for lead in leads:
            status = lead.get("status", "New")
            tag = ("hot"     if status == "Hot Lead"       else
                   "meeting" if status == "Meeting Booked" else
                   "emailed" if status == "Emailed"        else "normal")
            created = (lead.get("created_at") or "")[:10]
            self._tree.insert("", "end", values=(
                lead.get("lead_score", 0),
                (lead.get("name") or "")[:38],
                (lead.get("city") or "")[:20],
                lead.get("phone", ""),
                (lead.get("email") or "")[:32],
                lead.get("rating", ""),
                status,
                created,
            ), tags=(tag,))
        self._lead_count_lbl.config(text=f"{len(leads)} leads")

    def _refresh_stats(self):
        try:
            s = self._db.get_stats()
            self._pills["Total Leads"].set(s["total_leads"])
            self._pills["With Email"].set(s["with_email"])
            self._pills["Emails Sent"].set(s["emails_sent"])
            self._pills["Replies"].set(s["replies"])
            self._pills["Hot Leads"].set(s["hot_leads"])
            self._pills["Meetings"].set(s["meetings"])

            self._hot_lbl.config(text=f"🔥  Hot Leads: {s['hot_leads']}")
            self._hot_list.delete(0, "end")
            for lead in self._db.get_leads({"status": "Hot Lead"}):
                self._hot_list.insert(
                    "end",
                    f"  {lead.get('name','?')}  —  {lead.get('phone','No phone')}")

            # Today's stats
            ts = self._db.get_today_stats()
            self._today_stats_lbl.config(
                text=(f"  Scraped today:    {ts.get('scraped', 0)}\n"
                      f"  Sent today:       {ts.get('sent', 0)}\n"
                      f"  Replies today:    {ts.get('replied', 0)}\n"
                      f"  Hot leads today:  {ts.get('hot', 0)}\n\n"
                      f"  All-time leads:   {s['total_leads']}\n"
                      f"  All-time sent:    {s['emails_sent']}\n"
                      f"  Reply rate:       {s['open_rate']}"))
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════════════════════════
    # LOGGING
    # ═══════════════════════════════════════════════════════════════════════════

    def _enqueue_log(self, msg: str, level: str = "info"):
        self._q.put((msg, level))

    def _poll_queue(self):
        try:
            while True:
                msg, level = self._q.get_nowait()
                for log in [self._scrape_log, self._email_log,
                             self._fu_log, self._reply_log, self._report_log]:
                    try:
                        log.log(msg, level)
                    except Exception:
                        pass
        except queue.Empty:
            pass
        self.after(200, self._poll_queue)

    def _on_hot_lead(self, lead_id: int, sentiment: str):
        self.after(0, self._refresh_stats)
        self.after(0, self._load_leads)
        lead = self._db.get_lead_by_id(lead_id)
        if lead:
            self.after(0, lambda: messagebox.showinfo(
                "🔥  HOT LEAD ALERT!",
                f"{lead.get('name','?')} just replied positively!\n\n"
                f"📞  Phone:  {lead.get('phone', 'N/A')}\n"
                f"📧  Email:  {lead.get('email', 'N/A')}\n"
                f"📍  City:   {lead.get('city', 'N/A')}\n\n"
                "Call them NOW while they're warm! 🔥"
            ))


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = MoneyMachineApp()
    app.mainloop()
