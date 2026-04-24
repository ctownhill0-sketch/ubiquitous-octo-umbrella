// LeadStack™ — Scraper Engine Section
// Connects to Python backend to run the Google Maps scraper
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Play, Square, Plus, Trash2, MapPin, CheckCircle, Clock, Loader2, AlertCircle, Download } from "lucide-react";
import { startScrape, stopScrape, getScrapeStatus, exportLeadsCSV } from "@/lib/api";
import { toast } from "sonner";

const US_CITIES = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
  "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
  "Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "Charlotte, NC",
  "Indianapolis, IN", "San Francisco, CA", "Seattle, WA", "Denver, CO", "Nashville, TN",
  "Oklahoma City, OK", "El Paso, TX", "Washington, DC", "Las Vegas, NV", "Louisville, KY",
  "Memphis, TN", "Portland, OR", "Baltimore, MD", "Milwaukee, WI", "Albuquerque, NM",
  "Tucson, AZ", "Fresno, CA", "Sacramento, CA", "Mesa, AZ", "Kansas City, MO",
  "Atlanta, GA", "Omaha, NE", "Colorado Springs, CO", "Raleigh, NC", "Miami, FL",
  "Minneapolis, MN", "Tampa, FL", "New Orleans, LA", "Cleveland, OH", "Wichita, KS",
  "Arlington, TX", "Bakersfield, CA", "Aurora, CO", "Anaheim, CA", "Santa Ana, CA",
];

const KEYWORDS = [
  "independent financial advisor",
  "registered investment advisor",
  "fee-only financial planner",
  "wealth management firm",
  "financial planning firm",
  "RIA firm",
  "investment advisory firm",
];

type JobStatus = "pending" | "running" | "completed" | "failed";

interface LocalJob {
  id: string;
  city: string;
  keyword: string;
  status: JobStatus;
  leadsFound: number;
}

function statusIcon(status: JobStatus) {
  if (status === "completed") return <CheckCircle size={13} style={{ color: "oklch(0.72 0.18 142)" }} />;
  if (status === "running") return <Loader2 size={13} className="animate-spin" style={{ color: "oklch(0.72 0.12 75)" }} />;
  if (status === "failed") return <AlertCircle size={13} style={{ color: "oklch(0.65 0.2 25)" }} />;
  return <Clock size={13} style={{ color: "oklch(0.45 0.015 255)" }} />;
}

function statusColor(status: JobStatus) {
  if (status === "completed") return "oklch(0.72 0.18 142)";
  if (status === "running") return "oklch(0.72 0.12 75)";
  if (status === "failed") return "oklch(0.65 0.2 25)";
  return "oklch(0.45 0.015 255)";
}

export default function ScraperSection() {
  const [keyword, setKeyword] = useState(KEYWORDS[0]);
  const [cityInput, setCityInput] = useState("");
  const [cities, setCities] = useState<string[]>(US_CITIES.slice(0, 5));
  const [maxPerCity, setMaxPerCity] = useState(20);
  const [jobs, setJobs] = useState<LocalJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll scrape status while running
  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(async () => {
        try {
          const status = await getScrapeStatus();
          if (status) {
            setTotalFound(status.leadsFound);
            if (status.status === "completed" || status.status === "failed") {
              setIsRunning(false);
              if (pollRef.current) clearInterval(pollRef.current);
              // Update job statuses
              setJobs(prev => prev.map(j => ({
                ...j,
                status: status.status as JobStatus,
              })));
              if (status.status === "completed") {
                toast.success(`Scrape complete — ${status.leadsFound} leads found!`);
              } else {
                toast.error(`Scrape failed: ${status.error ?? "Unknown error"}`);
              }
            }
          }
        } catch {
          // backend may be offline
        }
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning]);

  const handleStart = async () => {
    if (cities.length === 0) {
      toast.error("Add at least one city to scrape.");
      return;
    }
    // Build local job list for display
    const newJobs: LocalJob[] = cities.map((city, i) => ({
      id: `job-${Date.now()}-${i}`,
      city,
      keyword,
      status: i === 0 ? "running" : "pending",
      leadsFound: 0,
    }));
    setJobs(newJobs);
    setTotalFound(0);
    setIsRunning(true);
    try {
      await startScrape({ keyword, cities, maxPerCity });
      toast.info(`Scraping ${cities.length} cities for "${keyword}"…`);
    } catch (e) {
      setIsRunning(false);
      setJobs([]);
      toast.error(`Failed to start scraper: ${e instanceof Error ? e.message : "Backend offline?"}`);
    }
  };

  const handleStop = async () => {
    try {
      await stopScrape();
      setIsRunning(false);
      setJobs(prev => prev.map(j => j.status === "running" || j.status === "pending"
        ? { ...j, status: "failed" } : j));
      toast.info("Scraper stopped.");
    } catch {
      setIsRunning(false);
    }
  };

  const addCity = () => {
    const c = cityInput.trim();
    if (c && !cities.includes(c)) {
      setCities(prev => [...prev, c]);
      setCityInput("");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>Scraper Engine</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>
            Google Maps → Lead extraction with email discovery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportLeadsCSV()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "oklch(0.72 0.12 75 / 0.1)", color: "oklch(0.72 0.12 75)", border: "1px solid oklch(0.72 0.12 75 / 0.2)" }}>
            <Download size={12} />
            Export CSV
          </button>
          {isRunning ? (
            <button onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "oklch(0.65 0.2 25 / 0.15)", color: "oklch(0.75 0.18 25)", border: "1px solid oklch(0.65 0.2 25 / 0.3)" }}>
              <Square size={13} />
              Stop Scraper
            </button>
          ) : (
            <button onClick={handleStart}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.09 0.02 255)" }}>
              <Play size={13} />
              Start Scraping
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config Panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-lg p-4 space-y-4"
          style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 65)" }}>Configuration</h3>

          {/* Keyword */}
          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "oklch(0.55 0.015 255)" }}>SEARCH KEYWORD</label>
            <select value={keyword} onChange={e => setKeyword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}>
              {KEYWORDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <input
              className="w-full px-3 py-2 rounded-lg text-xs outline-none mt-2"
              style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}
              placeholder="Or type a custom keyword…"
              onBlur={e => e.target.value && setKeyword(e.target.value)}
            />
          </div>

          {/* Max per city */}
          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "oklch(0.55 0.015 255)" }}>
              MAX LEADS PER CITY: <span style={{ color: "oklch(0.72 0.12 75)" }}>{maxPerCity}</span>
            </label>
            <input type="range" min={5} max={60} step={5} value={maxPerCity}
              onChange={e => setMaxPerCity(Number(e.target.value))}
              className="w-full accent-amber-400" />
            <div className="flex justify-between text-[9px] mt-1" style={{ color: "oklch(0.45 0.015 255)" }}>
              <span>5</span><span>60</span>
            </div>
          </div>

          {/* Stats */}
          <div className="pt-2 space-y-2" style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: "oklch(0.55 0.015 255)" }}>Cities queued</span>
              <span className="font-mono font-bold" style={{ color: "oklch(0.72 0.12 75)" }}>{cities.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "oklch(0.55 0.015 255)" }}>Max leads total</span>
              <span className="font-mono font-bold" style={{ color: "oklch(0.72 0.12 75)" }}>{cities.length * maxPerCity}</span>
            </div>
            {isRunning && (
              <div className="flex justify-between text-xs">
                <span style={{ color: "oklch(0.55 0.015 255)" }}>Found so far</span>
                <span className="font-mono font-bold" style={{ color: "oklch(0.72 0.18 142)" }}>{totalFound}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* City List */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-lg p-4"
          style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 65)" }}>Target Cities</h3>
            <span className="text-[10px] font-mono" style={{ color: "oklch(0.55 0.015 255)" }}>{cities.length} cities</span>
          </div>

          {/* Add city */}
          <div className="flex gap-2 mb-3">
            <input
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCity()}
              placeholder="Add city, State…"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}
            />
            <button onClick={addCity}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.72 0.12 75)" }}>
              <Plus size={13} />
            </button>
          </div>

          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {cities.map((city, i) => (
              <div key={city} className="flex items-center gap-2 px-2 py-1.5 rounded group"
                style={{ background: "oklch(1 0 0 / 0.02)" }}>
                <MapPin size={11} style={{ color: "oklch(0.72 0.12 75)", flexShrink: 0 }} />
                <span className="flex-1 text-xs" style={{ color: "oklch(0.80 0.008 65)" }}>{city}</span>
                <button onClick={() => setCities(prev => prev.filter((_, j) => j !== i))}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "oklch(0.45 0.015 255)" }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Quick add presets */}
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
            <p className="text-[10px] mb-2" style={{ color: "oklch(0.45 0.015 255)" }}>Quick add:</p>
            <div className="flex flex-wrap gap-1">
              {["Top 10 US", "Top 25 US", "Top 50 US"].map((preset, i) => (
                <button key={preset} onClick={() => setCities(US_CITIES.slice(0, [10, 25, 50][i]))}
                  className="text-[10px] px-2 py-1 rounded"
                  style={{ background: "oklch(0.72 0.12 75 / 0.1)", color: "oklch(0.72 0.12 75)", border: "1px solid oklch(0.72 0.12 75 / 0.2)" }}>
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Job Queue */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-lg p-4"
          style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 65)" }}>Job Queue</h3>
            {isRunning && (
              <div className="flex items-center gap-1.5 text-[10px]"
                style={{ color: "oklch(0.72 0.12 75)" }}>
                <Loader2 size={10} className="animate-spin" />
                Running…
              </div>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <MapPin size={24} style={{ color: "oklch(0.35 0.015 255)", marginBottom: 8 }} />
              <p className="text-xs" style={{ color: "oklch(0.45 0.015 255)" }}>No jobs yet.</p>
              <p className="text-[10px] mt-1" style={{ color: "oklch(0.35 0.015 255)" }}>Configure and click Start Scraping.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {jobs.map((job, i) => (
                <motion.div key={job.id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ background: "oklch(1 0 0 / 0.02)", border: "1px solid oklch(1 0 0 / 0.05)" }}>
                  {statusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 65)" }}>{job.city}</div>
                    <div className="text-[10px] truncate" style={{ color: "oklch(0.45 0.015 255)" }}>{job.keyword.slice(0, 25)}…</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {job.leadsFound > 0 && (
                      <div className="font-mono text-xs font-semibold" style={{ color: "oklch(0.72 0.12 75)" }}>
                        {job.leadsFound}
                      </div>
                    )}
                    <div className="text-[10px] capitalize" style={{ color: statusColor(job.status) }}>
                      {job.status}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Total */}
          {totalFound > 0 && (
            <div className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
              <span className="text-xs" style={{ color: "oklch(0.55 0.015 255)" }}>Total leads found</span>
              <span className="font-mono text-sm font-bold" style={{ color: "oklch(0.72 0.18 142)" }}>{totalFound}</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
