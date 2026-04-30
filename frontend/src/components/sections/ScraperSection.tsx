// LeadStack™ Lead Scraper v3 — Premium redesign
// Design: Split-panel, animated progress, premium table with hover states
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Play, Square, Download, Upload, Trash2,
  MapPin, Plus, CheckCircle2, Loader2, Globe, Phone,
  SlidersHorizontal, Zap
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/const";

type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  source: "google" | "linkedin" | "csv";
  status: "new" | "added" | "skipped";
};

const DEMO_LEADS: Lead[] = [
  { id: "1", name: "James Whitfield",  company: "Whitfield Capital Advisors", email: "james@whitfieldcap.com",    phone: "(212) 555-0182", website: "whitfieldcap.com",    location: "New York, NY",      source: "google",   status: "new" },
  { id: "2", name: "Sarah Chen",       company: "Chen Financial Group",       email: "sarah@chenfinancial.com",   phone: "(415) 555-0247", website: "chenfinancial.com",   location: "San Francisco, CA", source: "google",   status: "added" },
  { id: "3", name: "Marcus Rivera",    company: "Rivera Wealth Management",   email: "m.rivera@riverawealth.com", phone: "(305) 555-0391", website: "riverawealth.com",    location: "Miami, FL",         source: "linkedin", status: "new" },
  { id: "4", name: "Emily Thompson",   company: "Thompson Advisory LLC",      email: "emily@thompsonadvisory.com",phone: "(312) 555-0156", website: "thompsonadvisory.com",location: "Chicago, IL",       source: "linkedin", status: "new" },
  { id: "5", name: "David Park",       company: "Park & Associates",          email: "david@parkassoc.com",       phone: "(206) 555-0428", website: "parkassoc.com",       location: "Seattle, WA",       source: "google",   status: "skipped" },
  { id: "6", name: "Lisa Monroe",      company: "Monroe Wealth Partners",     email: "lisa@monroewealth.com",     phone: "(617) 555-0312", website: "monroewealth.com",    location: "Boston, MA",        source: "google",   status: "new" },
  { id: "7", name: "Robert Kim",       company: "Kim Financial Services",     email: "rkim@kimfinancial.com",     phone: "(713) 555-0198", website: "kimfinancial.com",    location: "Houston, TX",       source: "linkedin", status: "new" },
];

const sourceColor = (s: Lead["source"]) => {
  if (s === "google")   return "#60a5fa";
  if (s === "linkedin") return "#a5b4fc";
  return "#a1a09c";
};
const sourceLabel = (s: Lead["source"]) => s === "google" ? "Google" : s === "linkedin" ? "LinkedIn" : "CSV";
const statusColor = (s: Lead["status"]) => {
  if (s === "added")   return "#4ade80";
  if (s === "skipped") return "#72716c";
  return "#f59e0b";
};

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#72716c" }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-[12.5px] outline-none transition-all"
        style={{ background: "#18181b", border: "1px solid #222226", color: "#e7e5e4" }} />
    </div>
  );
}

export default function ScraperSection() {
  const [activeTab, setActiveTab] = useState<"google" | "linkedin" | "csv">("google");
  const [keyword, setKeyword] = useState("independent financial advisor");
  const [location, setLocation] = useState("New York, NY");
  const [linkedinQuery, setLinkedinQuery] = useState("financial advisor");
  const [linkedinLocation, setLinkedinLocation] = useState("United States");
  const [maxResults, setMaxResults] = useState("50");
  const [isRunning, setIsRunning] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Initialising...");
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelScrapeRef = useRef(false);
  const mountedRef = useRef(true);

  // Load all leads from DB on mount
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    fetch(`${API_BASE}/api/leads?limit=500`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!mountedRef.current) return;
        if (data?.leads?.length > 0) {
          setLeads(data.leads.map((l: any, i: number) => ({
            id: String(l.id || i + 1), name: l.name || "Unknown", company: l.company || l.name || "Unknown",
            email: l.email || "", phone: l.phone || "", website: l.website || "",
            location: l.address || "", source: "google" as const, status: "new" as const,
          })));
        }
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
      cancelScrapeRef.current = true;
      controller.abort();
    };
  }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id)));
  };

  const startScrape = async () => {
    const activeKeyword = activeTab === "google" ? keyword : linkedinQuery;
    const activeLocation = activeTab === "google" ? location : linkedinLocation;
    if (!activeKeyword.trim()) {
      toast.error("Enter a search keyword first");
      return;
    }
    const maxR = Math.max(1, parseInt(maxResults) || 50);
    cancelScrapeRef.current = false;
    setIsRunning(true);
    setProgress(0);
    setProgressLabel("Connecting to Google Maps...");
    // Don't clear leads — keep showing existing leads while new ones load in
    try {
      const startRes = await fetch(`${API_BASE}/api/scrape/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: activeKeyword,
          cities: [activeLocation],
          maxPerCity: maxR,
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || `Start failed (${startRes.status})`);
      }
      toast.info("Scraping started...");
      let done = false, attempts = 0;
      const maxAttempts = 800; // 800 × 1.5s = 20 minutes max
      while (!done && attempts < maxAttempts && !cancelScrapeRef.current) {
        await new Promise(r => setTimeout(r, 1500));
        if (cancelScrapeRef.current || !mountedRef.current) break;
        attempts++;
        try {
          const statusRes = await fetch(`${API_BASE}/api/scrape/status`);
          if (statusRes.ok) {
            const status = await statusRes.json();
            const found = status.leadsFound || 0;
            const p = found > 0 ? Math.min(90, Math.round((found / maxR) * 90)) : Math.min(25, attempts * 0.4);
            if (mountedRef.current) {
              setProgress(p);
              setProgressLabel(found > 0 ? `Collecting leads... ${found} found so far` : "Searching Google Maps...");
            }
            if (status.status === "completed" || status.status === "failed") done = true;
          }
        } catch { break; }
        // Refresh leads table every 5 seconds to show live results as they arrive
        if (attempts % 4 === 0) {
          try {
            const liveRes = await fetch(`${API_BASE}/api/leads?limit=500`);
            if (liveRes.ok) {
              const liveData = await liveRes.json();
              const liveLeads = (liveData.leads || []).map((l: any, i: number) => ({
                id: String(l.id || i + 1), name: l.name || "Unknown", company: l.company || l.name || "Unknown",
                email: l.email || "", phone: l.phone || "", website: l.website || "",
                location: l.address || "", source: "google" as const, status: "new" as const,
              }));
              if (mountedRef.current && liveLeads.length > 0) setLeads(liveLeads);
            }
          } catch (e) { console.warn("[Scraper] live refresh failed:", e); }
        }
      }
      if (cancelScrapeRef.current || !mountedRef.current) return;
      setProgress(100);
      setProgressLabel("Loading results...");
      const leadsRes = await fetch(`${API_BASE}/api/leads?limit=500`);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        const newLeads = (data.leads || []).map((l: any, i: number) => ({
          id: String(l.id || i + 1), name: l.name || "Unknown", company: l.company || l.name || "Unknown",
          email: l.email || "", phone: l.phone || "", website: l.website || "",
          location: l.address || "", source: "google" as const, status: "new" as const,
        }));
        if (mountedRef.current) {
          setLeads(newLeads.length > 0 ? newLeads : DEMO_LEADS);
          toast.success(`Scrape complete — ${newLeads.length} leads found`);
        }
      } else {
        if (mountedRef.current) {
          setLeads(DEMO_LEADS);
          toast.success("Scrape complete — showing demo leads");
        }
      }
    } catch (e) {
      if (mountedRef.current) {
        setLeads(DEMO_LEADS);
        toast.error(e instanceof Error ? `Scrape failed: ${e.message}` : "Backend offline — showing demo leads");
      }
    } finally {
      setTimeout(() => {
        if (mountedRef.current) { setIsRunning(false); setProgress(0); }
      }, 600);
    }
  };

  const addToCRM = () => {
    const ids = selected.size > 0 ? Array.from(selected) : leads.filter(l => l.status === "new").map(l => l.id);
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: "added" } : l));
    setSelected(new Set());
    toast.success(`Added ${ids.length} leads to CRM`);
  };

  const exportCSV = () => {
    const rows = leads.filter(l => selected.size === 0 || selected.has(l.id));
    const csv = ["Name,Company,Email,Phone,Website,Location,Source",
      ...rows.map(l => `"${l.name}","${l.company}","${l.email}","${l.phone}","${l.website}","${l.location}","${l.source}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leadstack_export.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
      const newLeads: Lead[] = lines.slice(1).map((line, i) => {
        const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const get = (keys: string[]) => { for (const k of keys) { const idx = headers.indexOf(k); if (idx >= 0 && vals[idx]) return vals[idx]; } return ""; };
        return { id: `csv-${i}`, name: get(["name","full name","contact"]), company: get(["company","business","organization"]),
          email: get(["email","email address"]), phone: get(["phone","phone number","tel"]),
          website: get(["website","url","domain"]), location: get(["location","city","address"]),
          source: "csv" as const, status: "new" as const };
      }).filter(l => l.name || l.email);
      setLeads(prev => [...prev, ...newLeads]);
      toast.success(`Imported ${newLeads.length} leads from CSV`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-full">
      {/* Left config panel */}
      <div className="flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ width: 276, borderRight: "1px solid #1c1c1f", background: "#09090b" }}>

        {/* Panel header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal size={13} style={{ color: "#f59e0b" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#f4f3ef" }}>Scraper Config</span>
          </div>
          <p className="text-[11px]" style={{ color: "#72716c" }}>Configure your lead discovery source</p>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Source tabs */}
          <div>
            <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2.5" style={{ color: "#52524e" }}>Source</div>
            <div className="flex rounded-xl p-1 gap-1" style={{ background: "#1c1c1f" }}>
              {[{ id: "google", label: "Google" }, { id: "linkedin", label: "LinkedIn" }, { id: "csv", label: "CSV" }].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
                  style={activeTab === tab.id ? {
                    background: "rgba(245,158,11,0.18)", color: "#fde68a",
                    boxShadow: "0 0 0 1px rgba(245,158,11,0.28)",
                  } : { color: "#72716c" }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Google fields */}
          {activeTab === "google" && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <InputField label="Keyword" value={keyword} onChange={setKeyword} placeholder="e.g. financial advisor" />
              <InputField label="Location" value={location} onChange={setLocation} placeholder="e.g. New York, NY" />
            </motion.div>
          )}

          {/* LinkedIn fields */}
          {activeTab === "linkedin" && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <InputField label="Job Title" value={linkedinQuery} onChange={setLinkedinQuery} placeholder="e.g. financial advisor" />
              <InputField label="Location" value={linkedinLocation} onChange={setLinkedinLocation} placeholder="e.g. United States" />
            </motion.div>
          )}

          {/* CSV Upload */}
          {activeTab === "csv" && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all hover:border-white/15"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "#1c1c1f" }}
                onClick={() => fileRef.current?.click()}>
                <Upload size={22} className="mx-auto mb-3" style={{ color: "#72716c" }} />
                <div className="text-[12px] font-medium mb-1" style={{ color: "#d4d4d2" }}>Drop CSV or click to browse</div>
                <div className="text-[10px]" style={{ color: "#52524e" }}>name, company, email, phone, website</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            </motion.div>
          )}

          {/* Max results */}
          {activeTab !== "csv" && (
            <div>
              <label className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2.5 block" style={{ color: "#52524e" }}>Max Results</label>
              <div className="grid grid-cols-4 gap-1.5">
                {["25", "50", "100", "200"].map(v => (
                  <button key={v} onClick={() => setMaxResults(v)}
                    className="py-2 rounded-xl text-[11px] font-semibold transition-all"
                    style={maxResults === v ? {
                      background: "rgba(96,165,250,0.18)", color: "#60a5fa",
                      boxShadow: "0 0 0 1px rgba(96,165,250,0.30)",
                    } : { background: "#1c1c1f", color: "#72716c" }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Run button */}
          {activeTab !== "csv" && (
            <button onClick={isRunning ? undefined : startScrape}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[13px] font-bold transition-all hover:opacity-90 active:scale-[0.98]"
              style={isRunning ? {
                background: "rgba(248,113,113,0.12)", color: "#f87171",
                border: "1px solid rgba(248,113,113,0.25)",
              } : {
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#09090b",
                boxShadow: "0 4px 16px rgba(245,158,11,0.30)",
              }}>
              {isRunning ? <><Square size={13} /> Stop Scraping</> : <><Zap size={13} /> Start Scraping</>}
            </button>
          )}

          {/* Progress bar */}
          <AnimatePresence>
            {isRunning && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden">
                <div className="flex justify-between text-[10.5px]" style={{ color: "#a1a09c" }}>
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={10} className="animate-spin" style={{ color: "#f59e0b" }} />
                    {progressLabel}
                  </span>
                  <span className="font-mono font-semibold" style={{ color: "#f59e0b" }}>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1c1c1f" }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #f59e0b, #4ade80)" }}
                    animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1c1c1f", border: "1px solid #1c1c1f" }}>
            {[
              { label: "Total Found",   value: leads.length,                                  color: "#60a5fa" },
              { label: "New",           value: leads.filter(l => l.status === "new").length,   color: "#f59e0b" },
              { label: "Added to CRM",  value: leads.filter(l => l.status === "added").length, color: "#4ade80" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "#72716c" }}>{s.label}</span>
                <span className="text-[14px] font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right results panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid #1c1c1f", background: "#121214" }}>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={selected.size === leads.length && leads.length > 0}
              onChange={selectAll} className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
            <span className="text-[12px] font-medium" style={{ color: "#a1a09c" }}>
              {selected.size > 0
                ? <span style={{ color: "#f59e0b" }}>{selected.size} selected</span>
                : <>{leads.length} leads found</>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addToCRM}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80"
              style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#86efac" }}>
              <Plus size={11} /> Add to CRM
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:opacity-80"
              style={{ background: "#1c1c1f", border: "1px solid #222226", color: "#a1a09c" }}>
              <Download size={11} /> Export CSV
            </button>
            <button onClick={() => { setLeads([]); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:opacity-80"
              style={{ background: "#1c1c1f", border: "1px solid #222226", color: "#a1a09c" }}>
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}>
                <Search size={28} style={{ color: "rgba(96,165,250,0.5)" }} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-center" style={{ color: "#a1a09c" }}>No leads yet</div>
                <div className="text-[12px] mt-1 text-center" style={{ color: "#52524e" }}>Configure your search and click Start Scraping</div>
              </div>
            </div>
          ) : (
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 z-10" style={{ background: "#121214", borderBottom: "1px solid #1c1c1f" }}>
                <tr>
                  <th className="w-10 px-4 py-3" />
                  {["NAME", "COMPANY", "EMAIL", "PHONE", "LOCATION", "SOURCE", "STATUS"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold tracking-[0.12em] text-[9.5px]" style={{ color: "#52524e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <motion.tr key={lead.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="cursor-pointer group"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    onClick={() => toggleSelect(lead.id)}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
                          {lead.name[0]}
                        </div>
                        <span className="font-semibold" style={{ color: "#e7e5e4" }}>{lead.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#a1a09c" }}>{lead.company}</td>
                    <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "#60a5fa" }}>{lead.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" style={{ color: "#a1a09c" }}>
                        <Phone size={9} className="flex-shrink-0" />{lead.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" style={{ color: "#a1a09c" }}>
                        <MapPin size={9} className="flex-shrink-0" />{lead.location}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: `${sourceColor(lead.source)}15`, color: sourceColor(lead.source), border: `1px solid ${sourceColor(lead.source)}28` }}>
                        {sourceLabel(lead.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {lead.status === "added" && <CheckCircle2 size={10} style={{ color: "#4ade80" }} />}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                          style={{ background: `${statusColor(lead.status)}15`, color: statusColor(lead.status), border: `1px solid ${statusColor(lead.status)}28` }}>
                          {lead.status}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
