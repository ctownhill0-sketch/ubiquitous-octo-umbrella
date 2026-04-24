// LeadStack™ Header v3 — Premium redesign
// Design: Clean top bar, gradient search, notification drawer, live clock
import { Bell, Search, Command, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  section: string;
  notifications?: number;
  backendOnline?: boolean;
  onNavigate?: (section: string) => void;
  onBriefing?: () => void;
}

const SECTION_META: Record<string, { label: string; description: string }> = {
  dashboard:      { label: "Dashboard",        description: "Overview of your outreach pipeline" },
  scraper:        { label: "Lead Scraper",     description: "Discover and import new leads" },
  linkedin:       { label: "LinkedIn Scraper", description: "Scrape decision-makers from LinkedIn" },
  email:          { label: "Email Engine",     description: "Compose and launch email campaigns" },
  followup:       { label: "Sequences",        description: "Automated follow-up sequences" },
  replies:        { label: "Reply Monitor",    description: "Track and respond to replies" },
  crm:            { label: "Pipeline CRM",     description: "Manage your deal pipeline" },
  analytics:      { label: "Analytics",        description: "Performance metrics and insights" },
  warmup:         { label: "Email Warmup",     description: "Build sender reputation and inbox rotation" },
  deliverability: { label: "Spam Checker",     description: "Test deliverability before sending" },
  settings:       { label: "Settings",         description: "Configure your workspace" },
};

type SearchResult = {
  id: number;
  name: string;
  company?: string;
  email: string;
  city?: string;
  status: string;
  lead_score?: number;
};

const BASE = "http://localhost:7432/api";

export default function Header({ section, notifications = 0, backendOnline = false, onNavigate, onBriefing }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notifList, setNotifList] = useState([
    { id: 1, text: "Hot Lead: Sarah Chen replied", sub: "Pinnacle Wealth · 2 min ago", color: "oklch(0.65 0.22 25)", read: false },
    { id: 2, text: "Hot Lead: Kevin Lee replied", sub: "Lee Investment · 1 hr ago", color: "oklch(0.65 0.22 25)", read: false },
    { id: 3, text: "Scraper completed: New York, NY", sub: "23 leads found · 3 hrs ago", color: "oklch(0.65 0.18 145)", read: true },
  ]);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unread = notifList.filter(n => !n.read).length;
  const meta = SECTION_META[section] || { label: section, description: "" };

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(v => !v);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setSearch("");
        setResults([]);
        setShowNotifs(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showSearch]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || data.leads || []);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => doSearch(search), 250);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search, doSearch]);

  function scoreColor(score?: number) {
    if (!score) return { label: "Cold", color: "oklch(0.55 0.10 230)" };
    if (score >= 75) return { label: "Hot", color: "oklch(0.72 0.20 25)" };
    if (score >= 50) return { label: "Warm", color: "oklch(0.72 0.15 55)" };
    return { label: "Cold", color: "oklch(0.55 0.10 230)" };
  }

  return (
    <header
      className="flex items-center justify-between flex-shrink-0 relative z-10"
      style={{
        background: "oklch(0.10 0.022 255)",
        borderBottom: "1px solid oklch(1 0 0 / 0.07)",
        height: 60,
        padding: "0 24px",
      }}
    >
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-[15px] font-semibold leading-tight" style={{ color: "oklch(0.93 0.008 65)" }}>
            {meta.label}
          </h1>
          <div className="text-[10.5px] mt-0.5" style={{ color: "oklch(0.42 0.015 255)" }}>
            {meta.description}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">

        {/* Daily Briefing button */}
        {onBriefing && (
          <button onClick={onBriefing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
            style={{ background: "oklch(0.72 0.12 75 / 0.12)", border: "1px solid oklch(0.72 0.12 75 / 0.25)", color: "oklch(0.82 0.14 75)" }}>
            <Sparkles size={11} />
            Daily Briefing
          </button>
        )}

        {/* Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono"
          style={{ color: "oklch(0.45 0.015 255)", background: "oklch(1 0 0 / 0.03)" }}>
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>

        {/* Global Search trigger */}
        <div className="relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[11.5px] transition-all hover:border-white/12"
            style={{
              background: "oklch(1 0 0 / 0.04)",
              border: "1px solid oklch(1 0 0 / 0.09)",
              color: "oklch(0.48 0.015 255)",
              minWidth: 200,
            }}
          >
            <Search size={12} />
            <span className="flex-1 text-left">Search leads...</span>
            <kbd className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md"
              style={{ background: "oklch(1 0 0 / 0.07)", color: "oklch(0.40 0.015 255)" }}>
              <Command size={8} />K
            </kbd>
          </button>

          <AnimatePresence>
            {showSearch && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setShowSearch(false); setSearch(""); setResults([]); }} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-11 w-96 rounded-2xl overflow-hidden z-50"
                  style={{
                    background: "oklch(0.14 0.026 255)",
                    border: "1px solid oklch(1 0 0 / 0.12)",
                    boxShadow: "0 24px 64px oklch(0 0 0 / 0.55), 0 0 0 1px oklch(1 0 0 / 0.06)",
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
                    <Search size={14} style={{ color: "oklch(0.55 0.015 255)", flexShrink: 0 }} />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search leads, companies, emails..."
                      className="flex-1 bg-transparent text-[13px] outline-none"
                      style={{ color: "oklch(0.92 0.008 65)" }}
                    />
                    {searching ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                        style={{ borderColor: "oklch(0.72 0.12 75 / 0.5)", borderTopColor: "transparent" }} />
                    ) : (
                      <kbd className="text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: "oklch(1 0 0 / 0.07)", color: "oklch(0.45 0.015 255)" }}>
                        Esc
                      </kbd>
                    )}
                  </div>

                  {results.length > 0 ? (
                    <div className="py-1.5">
                      {results.map(lead => {
                        const { label, color } = scoreColor(lead.lead_score);
                        return (
                          <div key={lead.id}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.04]"
                            onClick={() => {
                              setShowSearch(false);
                              setSearch("");
                              setResults([]);
                              if (onNavigate) onNavigate("crm");
                            }}
                          >
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                              style={{ background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.82 0.14 75)" }}>
                              {(lead.name || "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-medium truncate" style={{ color: "oklch(0.88 0.008 65)" }}>{lead.name}</div>
                              <div className="text-[10.5px] truncate" style={{ color: "oklch(0.50 0.015 255)" }}>
                                {lead.email}{lead.city ? ` · ${lead.city}` : ""}
                              </div>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                              style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                      <div className="px-4 py-2 text-[10px] text-center" style={{ color: "oklch(0.40 0.015 255)", borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
                        Click a result to open in Pipeline CRM
                      </div>
                    </div>
                  ) : search.length > 1 && !searching ? (
                    <div className="px-4 py-6 text-[12px] text-center" style={{ color: "oklch(0.50 0.015 255)" }}>
                      No leads found for "<span style={{ color: "oklch(0.72 0.12 75)" }}>{search}</span>"
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-[11px]" style={{ color: "oklch(0.45 0.015 255)" }}>
                      Type to search across all leads...
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.05]"
            style={{ color: "oklch(0.50 0.015 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}
          >
            <Bell size={15} />
            {unread > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center"
                style={{ background: "oklch(0.65 0.22 25)", color: "white", boxShadow: "0 0 0 2px oklch(0.10 0.022 255)" }}>
                {unread}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-11 w-80 rounded-2xl overflow-hidden z-50"
                  style={{
                    background: "oklch(0.14 0.026 255)",
                    border: "1px solid oklch(1 0 0 / 0.12)",
                    boxShadow: "0 24px 64px oklch(0 0 0 / 0.55), 0 0 0 1px oklch(1 0 0 / 0.06)",
                  }}
                >
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
                    <span className="text-[13px] font-semibold" style={{ color: "oklch(0.92 0.008 65)" }}>Notifications</span>
                    {unread > 0 && (
                      <button
                        className="text-[10px] font-medium transition-opacity hover:opacity-70"
                        style={{ color: "oklch(0.72 0.12 75)" }}
                        onClick={() => setNotifList(prev => prev.map(n => ({ ...n, read: true })))}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="py-1.5">
                    {notifList.map(n => (
                      <div key={n.id}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03]"
                        onClick={() => setNotifList(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}>
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: n.read ? "oklch(1 0 0 / 0.15)" : n.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium leading-snug"
                            style={{ color: n.read ? "oklch(0.55 0.015 255)" : "oklch(0.85 0.008 65)" }}>
                            {n.text}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.40 0.015 255)" }}>{n.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
