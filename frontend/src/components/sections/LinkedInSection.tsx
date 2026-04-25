// LeadStack™ LinkedIn Scraper Section
// Premium UI for LinkedIn lead scraping with session management

import { useState, useEffect, useRef } from "react";
import {
  Linkedin, Search, Play, Square, Users, Building2,
  MapPin, ExternalLink, CheckCircle2, AlertCircle,
  Loader2, Download, Plus, RefreshCw, Shield, Zap,
  ChevronRight, Filter, Star
} from "lucide-react";
import { toast } from "sonner";

const BASE = "http://localhost:7432/api";

interface LinkedInLead {
  name: string;
  title: string;
  company: string;
  location: string;
  profile_url: string;
  connection_degree: string;
  source: string;
}

export default function LinkedInSection() {
  const [sessionStatus, setSessionStatus] = useState<"checking" | "logged_in" | "not_logged_in">("checking");
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(25);
  const [connectionFilter, setConnectionFilter] = useState("all");
  const [scraping, setScraping] = useState(false);
  const [leads, setLeads] = useState<LinkedInLead[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressName, setProgressName] = useState("");
  const [savingToDb, setSavingToDb] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [loggingIn, setLoggingIn] = useState(false);

  // Track polling/timeout handles so we can cancel them on unmount.
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkSession();
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const checkSession = async () => {
    setSessionStatus("checking");
    try {
      const res = await fetch(`${BASE}/linkedin/session`);
      const data = await res.json();
      if (!mountedRef.current) return;
      setSessionStatus(data.logged_in ? "logged_in" : "not_logged_in");
    } catch {
      if (!mountedRef.current) return;
      setSessionStatus("not_logged_in");
    }
  };

  const stopLoginPoll = () => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  };

  const openLoginBrowser = async () => {
    setLoggingIn(true);
    try {
      const res = await fetch(`${BASE}/linkedin/login`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.message || "Could not open browser");
        setLoggingIn(false);
      } else {
        toast.info("Browser opened — log in to LinkedIn, then come back here");
        // Poll for session every 5 seconds, give up after 3 minutes.
        pollIntervalRef.current = setInterval(async () => {
          try {
            const check = await fetch(`${BASE}/linkedin/session`);
            const status = await check.json();
            if (status.logged_in && mountedRef.current) {
              stopLoginPoll();
              setSessionStatus("logged_in");
              setLoggingIn(false);
              toast.success("LinkedIn connected");
            }
          } catch {
            // Network blip; keep polling until timeout.
          }
        }, 5000);
        pollTimeoutRef.current = setTimeout(() => {
          stopLoginPoll();
          if (mountedRef.current) {
            setLoggingIn(false);
            toast.info("Login window timed out — try again if you didn't finish.");
          }
        }, 180000);
      }
    } catch {
      toast.error("Backend not running — start the backend first");
      setLoggingIn(false);
    }
  };

  const startScrape = async () => {
    if (!keyword.trim()) { toast.error("Enter a search keyword"); return; }
    setScraping(true);
    setLeads([]);
    setProgress(0);
    setProgressName("");

    try {
      const res = await fetch(`${BASE}/linkedin/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          location,
          max_results: maxResults,
          filters: connectionFilter !== "all" ? { connection_degree: connectionFilter } : {},
        }),
      });
      const data = await res.json();

      if (data.error === "linkedin_not_logged_in") {
        setSessionStatus("not_logged_in");
        toast.error("LinkedIn session expired — please log in again");
      } else if (data.error) {
        toast.error(data.message || data.error);
      } else {
        setLeads(data.leads || []);
        toast.success(`Found ${(data.leads || []).length} leads`);
      }
    } catch {
      toast.error("Backend not running");
    } finally {
      setScraping(false);
    }
  };

  const saveToDatabase = async () => {
    if (!leads.length) return;
    setSavingToDb(true);
    try {
      const res = await fetch(`${BASE}/linkedin/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      setSavedCount(data.saved || 0);
      toast.success(`Saved ${data.saved} new leads (${data.skipped} duplicates skipped)`);
    } catch {
      toast.error("Failed to save leads");
    } finally {
      setSavingToDb(false);
    }
  };

  const exportCSV = () => {
    if (!leads.length) return;
    const headers = ["Name", "Title", "Company", "Location", "Profile URL", "Connection"];
    const rows = leads.map(l => [l.name, l.title, l.company, l.location, l.profile_url, l.connection_degree]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkedin_leads_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex h-full" style={{ background: "oklch(0.08 0.018 255)" }}>

      {/* ── Left Panel ──────────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r" style={{ borderColor: "oklch(1 0 0 / 0.07)", background: "oklch(0.09 0.020 255)" }}>

        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: "oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.48 0.18 240 / 0.18)", border: "1px solid oklch(0.48 0.18 240 / 0.30)" }}>
              <Linkedin size={14} style={{ color: "oklch(0.60 0.18 240)" }} />
            </div>
            <span className="text-[14px] font-black" style={{ color: "oklch(0.90 0.008 65)" }}>LinkedIn Scraper</span>
          </div>
          <p className="text-[10px]" style={{ color: "oklch(0.42 0.015 255)" }}>
            Scrape decision-makers by title, company & location
          </p>
        </div>

        {/* Session status */}
        <div className="p-4 border-b" style={{ borderColor: "oklch(1 0 0 / 0.07)" }}>
          {sessionStatus === "checking" ? (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "oklch(0.48 0.015 255)" }}>
              <Loader2 size={12} className="animate-spin" /> Checking session...
            </div>
          ) : sessionStatus === "logged_in" ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.65 0.18 145)" }} />
                <span className="text-[11px] font-semibold" style={{ color: "oklch(0.65 0.18 145)" }}>LinkedIn Connected</span>
              </div>
              <button onClick={checkSession} className="opacity-50 hover:opacity-100">
                <RefreshCw size={11} style={{ color: "oklch(0.48 0.015 255)" }} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.65 0.2 25)" }} />
                <span className="text-[11px]" style={{ color: "oklch(0.65 0.2 25)" }}>Not connected</span>
              </div>
              <button onClick={openLoginBrowser} disabled={loggingIn}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "oklch(0.48 0.18 240 / 0.15)", border: "1px solid oklch(0.48 0.18 240 / 0.30)", color: "oklch(0.60 0.18 240)" }}>
                {loggingIn ? <Loader2 size={10} className="animate-spin" /> : <Linkedin size={10} />}
                {loggingIn ? "Opening browser..." : "Connect LinkedIn"}
              </button>
              <p className="text-[9px]" style={{ color: "oklch(0.35 0.015 255)" }}>
                Opens a browser window — log in once, sessions persist
              </p>
            </div>
          )}
        </div>

        {/* Search form */}
        <div className="p-4 flex-1 space-y-4 overflow-y-auto">
          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "oklch(0.40 0.015 255)" }}>
              Job Title / Keyword *
            </label>
            <input value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. Financial Advisor"
              className="w-full px-3 py-2.5 rounded-lg text-[12px] outline-none"
              style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.88 0.008 65)" }} />
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "oklch(0.40 0.015 255)" }}>
              Location
            </label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. London, UK"
              className="w-full px-3 py-2.5 rounded-lg text-[12px] outline-none"
              style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.88 0.008 65)" }} />
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "oklch(0.40 0.015 255)" }}>
              Max Results
            </label>
            <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg text-[12px] outline-none"
              style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.88 0.008 65)" }}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} leads</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "oklch(0.40 0.015 255)" }}>
              Connection Degree
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: "all", label: "All" },
                { value: "F", label: "1st" },
                { value: "S", label: "2nd" },
                { value: "O", label: "3rd+" },
              ].map(opt => (
                <button key={opt.value} onClick={() => setConnectionFilter(opt.value)}
                  className="py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={connectionFilter === opt.value
                    ? { background: "oklch(0.48 0.18 240 / 0.20)", border: "1px solid oklch(0.48 0.18 240 / 0.40)", color: "oklch(0.60 0.18 240)" }
                    : { background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.42 0.015 255)" }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startScrape} disabled={scraping || sessionStatus !== "logged_in" || !keyword.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.14 75), oklch(0.68 0.12 65))", color: "oklch(0.10 0.025 255)", boxShadow: "0 4px 16px oklch(0.72 0.12 75 / 0.25)" }}>
            {scraping ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {scraping ? "Scraping..." : "Start Scrape"}
          </button>

          {scraping && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px]" style={{ color: "oklch(0.48 0.015 255)" }}>
                <span>{progressName || "Searching..."}</span>
                <span>{progress}/{maxResults}</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 0.06)" }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(progress / maxResults) * 100}%`, background: "oklch(0.72 0.12 75)" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold" style={{ color: "oklch(0.90 0.008 65)" }}>
              {leads.length > 0 ? `${leads.length} leads found` : "Results"}
            </span>
            {leads.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "oklch(0.72 0.12 75 / 0.12)", color: "oklch(0.82 0.14 75)", border: "1px solid oklch(0.72 0.12 75 / 0.20)" }}>
                LinkedIn
              </span>
            )}
          </div>
          {leads.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                style={{ background: "oklch(0.14 0.024 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.62 0.015 255)" }}>
                <Download size={11} /> Export CSV
              </button>
              <button onClick={saveToDatabase} disabled={savingToDb}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "oklch(0.65 0.18 145 / 0.15)", border: "1px solid oklch(0.65 0.18 145 / 0.30)", color: "oklch(0.65 0.18 145)" }}>
                {savingToDb ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                Save to CRM
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {leads.length === 0 && !scraping ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "oklch(0.48 0.18 240 / 0.08)", border: "1px solid oklch(0.48 0.18 240 / 0.15)" }}>
                <Linkedin size={28} style={{ color: "oklch(0.48 0.18 240 / 0.40)" }} />
              </div>
              <div className="text-[14px] font-bold mb-1" style={{ color: "oklch(0.55 0.015 255)" }}>
                {sessionStatus === "not_logged_in" ? "Connect LinkedIn to start" : "Search for leads"}
              </div>
              <div className="text-[11px] max-w-xs" style={{ color: "oklch(0.38 0.015 255)" }}>
                {sessionStatus === "not_logged_in"
                  ? "Click 'Connect LinkedIn' to open a browser and log in once. Sessions persist automatically."
                  : "Enter a job title and location, then click Start Scrape to find decision-makers."}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {leads.map((lead, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl transition-all hover:translate-y-[-1px]"
                  style={{ background: "oklch(0.11 0.022 255)", border: "1px solid oklch(1 0 0 / 0.07)", boxShadow: "0 2px 8px oklch(0 0 0 / 0.15)" }}>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-black"
                    style={{ background: "oklch(0.48 0.18 240 / 0.15)", color: "oklch(0.60 0.18 240)", border: "1px solid oklch(0.48 0.18 240 / 0.20)" }}>
                    {lead.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold truncate" style={{ color: "oklch(0.90 0.008 65)" }}>{lead.name}</span>
                      {lead.connection_degree && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold flex-shrink-0"
                          style={{ background: "oklch(0.48 0.18 240 / 0.12)", color: "oklch(0.60 0.18 240)", border: "1px solid oklch(0.48 0.18 240 / 0.20)" }}>
                          {lead.connection_degree}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] truncate mb-0.5" style={{ color: "oklch(0.62 0.015 255)" }}>
                      {lead.title}{lead.company ? ` · ${lead.company}` : ""}
                    </div>
                    {lead.location && (
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: "oklch(0.42 0.015 255)" }}>
                        <MapPin size={9} /> {lead.location}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {lead.profile_url && (
                    <a href={lead.profile_url} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: "oklch(0.14 0.024 255)", border: "1px solid oklch(1 0 0 / 0.09)" }}>
                      <ExternalLink size={11} style={{ color: "oklch(0.48 0.015 255)" }} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
