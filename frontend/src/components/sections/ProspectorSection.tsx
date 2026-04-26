// LeadStack — Prospector (Block 8)
// Filter-driven B2B contact search. Operates against the local lead DB so
// it works offline; in production this same UI talks to a Clay/Apollo-style
// enrichment provider via the backend.
import { useEffect, useMemo, useState } from "react";
import {
  Search, ChevronDown, ChevronRight as ChevDown, MapPin, Building2,
  Briefcase, Cpu, DollarSign, Activity, Plus, Save, Download,
  CheckCircle2, X, Compass,
} from "lucide-react";
import { toast } from "sonner";

// ---------- Types ----------
type Match = {
  id: number | string;
  name: string;
  title: string;
  company: string;
  size: string;
  industry: string;
  location: string;
  email: string;
  emailQuality: "high" | "medium" | "low";
  funding: string;
  stack: string[];
};

const TITLE_PRESETS = ["CTO", "VP of Engineering", "VP of Sales", "Head of Growth", "Founder"];
const STACK = ["HubSpot", "Salesforce", "Slack", "Segment", "Snowflake", "Notion"];
const STAGES = ["Seed", "Series A", "Series B", "Series C+", "Bootstrapped"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const INDUSTRIES = ["SaaS", "Fintech", "Healthcare", "E-commerce", "Cybersecurity"];

// ---------- Demo seed (used until the backend returns real prospects) ----------
const DEMO: Match[] = [
  { id: "p1", name: "Sarah Okonkwo",   title: "Head of Growth",     company: "Brightside SaaS", size: "11-50",  industry: "SaaS",      location: "San Francisco, CA", email: "sarah@brightside.io",   emailQuality: "high",   funding: "Series A", stack: ["HubSpot", "Slack"] },
  { id: "p2", name: "Marcus Chen",     title: "CTO",                company: "Vertex Analytics", size: "11-50",  industry: "SaaS",      location: "Austin, TX",        email: "m.chen@vertex.io",       emailQuality: "high",   funding: "Series A", stack: ["Segment", "Snowflake"] },
  { id: "p3", name: "Priya Kapoor",    title: "VP of Engineering",  company: "NovaFlow Inc.",   size: "11-50",  industry: "SaaS",      location: "New York, NY",      email: "priya@novaflow.io",      emailQuality: "high",   funding: "Series A", stack: ["HubSpot"] },
  { id: "p4", name: "Tom Reilly",      title: "Founder",            company: "Cascade Digital", size: "1-10",   industry: "SaaS",      location: "Seattle, WA",       email: "tom@cascade.dev",        emailQuality: "medium", funding: "Bootstrapped", stack: ["Slack"] },
  { id: "p5", name: "Anita Ruiz",      title: "Head of Growth",     company: "Helios Group",    size: "51-200", industry: "Fintech",   location: "Miami, FL",         email: "anita@heliosgroup.com",  emailQuality: "high",   funding: "Series B", stack: ["Salesforce"] },
  { id: "p6", name: "David Kim",       title: "CTO",                company: "Stratum Labs",    size: "11-50",  industry: "Cybersecurity", location: "Boston, MA",   email: "dkim@stratumlabs.io",    emailQuality: "medium", funding: "Series A", stack: ["Snowflake"] },
  { id: "p7", name: "Elena Petrov",    title: "VP of Sales",        company: "Meridian Corp",   size: "201-500", industry: "SaaS",     location: "London, UK",        email: "elena@meridian.co",      emailQuality: "high",   funding: "Series B", stack: ["HubSpot", "Salesforce"] },
  { id: "p8", name: "Fatima Al-Hassan", title: "Head of Growth",    company: "Nexus Growth",    size: "11-50",  industry: "SaaS",      location: "Dubai, UAE",        email: "fatima@nexusgrowth.io",  emailQuality: "high",   funding: "Series A", stack: ["Segment", "Slack"] },
];

// ---------- Filter group component ----------
function FilterGroup({
  label,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  label: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: "var(--border-divider)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5"
        style={{ color: "var(--text-secondary)" }}
      >
        <Icon size={13} />
        <span className="flex-1 text-left text-[12px] font-semibold uppercase tracking-wider">
          {label}
        </span>
        {open ? <ChevDown size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
      style={{
        background: active ? "var(--amber-soft)" : "transparent",
        border: `1px solid ${active ? "rgba(245,158,11,0.4)" : "var(--border-edge)"}`,
        color: active ? "var(--amber-text)" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between text-[12px] cursor-pointer">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 28, height: 16, borderRadius: 999,
          background: checked ? "var(--amber)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${checked ? "var(--amber)" : "var(--border-edge)"}`,
          position: "relative", transition: "background 100ms ease",
        }}
        aria-label={label}
      >
        <span style={{
          position: "absolute", top: 1, left: checked ? 13 : 1,
          width: 12, height: 12, borderRadius: 999,
          background: checked ? "#09090b" : "#a1a09c",
          transition: "left 120ms ease",
        }} />
      </button>
    </label>
  );
}

// ---------- Main ----------
export default function ProspectorSection() {
  // Filter state
  const [titles, setTitles] = useState<string[]>(["CTO", "Head of Growth"]);
  const [titleInput, setTitleInput] = useState("");
  const [sizes, setSizes] = useState<string[]>(["11-50", "51-200"]);
  const [industries, setIndustries] = useState<string[]>(["SaaS"]);
  const [stages, setStages] = useState<string[]>(["Series A"]);
  const [stack, setStack] = useState<string[]>(["HubSpot"]);
  const [intentHiring, setIntentHiring] = useState(true);
  const [intentLinkedIn, setIntentLinkedIn] = useState(true);
  const [intentVisited, setIntentVisited] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [results, setResults] = useState<Match[]>(DEMO);
  const [adding, setAdding] = useState<Set<string | number>>(new Set());
  const [added, setAdded] = useState<Set<string | number>>(new Set());

  const toggle = (state: string[], setter: (s: string[]) => void, value: string) => {
    setter(state.includes(value) ? state.filter((v) => v !== value) : [...state, value]);
  };

  const filtered = useMemo(() => {
    return results.filter((m) => {
      if (titles.length && !titles.some((t) => m.title.toLowerCase().includes(t.toLowerCase()))) return false;
      if (sizes.length && !sizes.includes(m.size)) return false;
      if (industries.length && !industries.includes(m.industry)) return false;
      if (stages.length && !stages.includes(m.funding)) return false;
      if (stack.length && !stack.some((s) => m.stack.includes(s))) return false;
      return true;
    });
  }, [results, titles, sizes, industries, stages, stack]);

  // Hydrate with real leads from backend if any exist; merge into DEMO so the
  // empty backend still feels populated.
  useEffect(() => {
    let cancelled = false;
    fetch("http://localhost:7432/api/leads?limit=80")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.leads?.length) return;
        const real: Match[] = data.leads.slice(0, 12).map((l: any) => ({
          id: l.id,
          name: l.name || "Unknown contact",
          title: l.category || "Decision-maker",
          company: l.name || "—",
          size: ["11-50", "51-200"][l.id % 2] ?? "11-50",
          industry: ["SaaS", "Fintech", "Cybersecurity"][l.id % 3] ?? "SaaS",
          location: l.address || l.city || "—",
          email: l.email || "no-email-on-file",
          emailQuality: l.email ? "high" : "low",
          funding: ["Series A", "Series B", "Bootstrapped"][l.id % 3] ?? "Series A",
          stack: ["HubSpot"],
        }));
        setResults([...real, ...DEMO]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const addToLeadStack = async (m: Match) => {
    setAdding((prev) => new Set(prev).add(m.id));
    try {
      const res = await fetch("http://localhost:7432/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: m.name,
          email: m.email !== "no-email-on-file" ? m.email : "",
          category: m.title,
          city: m.location,
          notes: `From Prospector — ${m.company} (${m.industry}, ${m.funding})`,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setAdded((prev) => new Set(prev).add(m.id));
      toast.success(`Added ${m.name} to LeadStack`);
    } catch (e) {
      toast.error(e instanceof Error ? `Could not add ${m.name}: ${e.message}` : "Add failed");
    } finally {
      setAdding((prev) => {
        const next = new Set(prev);
        next.delete(m.id);
        return next;
      });
    }
  };

  const addAll = async () => {
    for (const m of filtered.slice(0, 25)) {
      // sequentially to avoid hammering the backend; first 25 only.
      // eslint-disable-next-line no-await-in-loop
      await addToLeadStack(m);
    }
  };

  // ----- Render -----
  return (
    <div className="flex h-full" style={{ background: "var(--bg-base)" }}>
      {/* Filter panel */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-divider)",
          overflowY: "auto",
        }}
      >
        <div className="px-3 py-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid var(--border-divider)" }}>
          <Compass size={14} color="var(--amber-text)" />
          <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Filters
          </span>
        </div>

        <FilterGroup label="Job Title" icon={Briefcase}>
          <div className="flex flex-wrap gap-1.5">
            {titles.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-1 ls-num"
                style={{
                  background: "var(--amber-soft)",
                  color: "var(--amber-text)",
                  border: "1px solid rgba(245,158,11,0.35)",
                }}
              >
                {t}
                <button
                  onClick={() => setTitles(titles.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                  className="opacity-70 hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && titleInput.trim()) {
                  e.preventDefault();
                  if (!titles.includes(titleInput.trim())) {
                    setTitles([...titles, titleInput.trim()]);
                  }
                  setTitleInput("");
                }
              }}
              placeholder="+ Add title"
              className="ls-input"
              style={{ height: 26, fontSize: 11, width: 110, padding: "0 8px" }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {TITLE_PRESETS.filter((p) => !titles.includes(p)).map((p) => (
              <button
                key={p}
                onClick={() => setTitles([...titles, p])}
                className="text-[10.5px] px-2 py-0.5 rounded-md"
                style={{ color: "var(--text-muted)", border: "1px dashed var(--border-edge)" }}
              >
                + {p}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Company Size" icon={Building2}>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((s) => (
              <Chip key={s} label={s} active={sizes.includes(s)} onClick={() => toggle(sizes, setSizes, s)} />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Industry" icon={Building2}>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map((i) => (
              <Chip key={i} label={i} active={industries.includes(i)} onClick={() => toggle(industries, setIndustries, i)} />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Funding" icon={DollarSign}>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <Chip key={s} label={s} active={stages.includes(s)} onClick={() => toggle(stages, setStages, s)} />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Tech Stack" icon={Cpu} defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {STACK.map((s) => (
              <Chip key={s} label={s} active={stack.includes(s)} onClick={() => toggle(stack, setStack, s)} />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Intent Signals" icon={Activity} defaultOpen={false}>
          <Toggle checked={intentHiring}   onChange={setIntentHiring}   label="Actively hiring in sales" />
          <Toggle checked={intentLinkedIn} onChange={setIntentLinkedIn} label="Recent LinkedIn activity" />
          <Toggle checked={intentVisited}  onChange={setIntentVisited}  label="Visited our website" />
        </FilterGroup>
      </aside>

      {/* Results panel */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header bar */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-divider)" }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Contacts found
            </div>
            <div className="ls-num text-[24px]" style={{ color: "var(--amber-text)" }}>
              {filtered.length.toLocaleString()}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 ml-4 flex-1">
            {[...titles.map((t) => `Title: ${t}`),
              ...sizes.map((s) => `Size: ${s}`),
              ...industries.map((i) => `Industry: ${i}`),
              ...stages.map((s) => `Funding: ${s}`),
              ...stack.map((s) => `Stack: ${s}`)].map((label) => (
              <span key={label}
                className="ls-badge ls-bare ls-badge-amber text-[10.5px]">
                {label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-md"
              style={{ border: "1px solid var(--border-edge)" }}
            >
              <button
                onClick={() => setView("list")}
                style={{
                  height: 28, padding: "0 10px", fontSize: 11,
                  background: view === "list" ? "var(--amber-soft)" : "transparent",
                  color: view === "list" ? "var(--amber-text)" : "var(--text-secondary)",
                  borderRight: "1px solid var(--border-edge)",
                }}
              >
                List
              </button>
              <button
                onClick={() => setView("cards")}
                style={{
                  height: 28, padding: "0 10px", fontSize: 11,
                  background: view === "cards" ? "var(--amber-soft)" : "transparent",
                  color: view === "cards" ? "var(--amber-text)" : "var(--text-secondary)",
                }}
              >
                Cards
              </button>
            </div>
            <button className="ls-btn-ghost">
              <Save size={12} /> Save search
            </button>
            <button className="ls-btn-ghost">
              <Download size={12} /> Export
            </button>
            <button className="ls-btn-primary" onClick={addAll}>
              <Plus size={13} /> Add all to LeadStack
            </button>
          </div>
        </div>

        {/* Results body */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Search size={18} color="var(--amber-text)" />
              </div>
              <div className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                No matches for these filters
              </div>
              <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                Loosen a filter or try different titles to widen the net.
              </div>
            </div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((m) => (
                <ProspectCard
                  key={m.id}
                  match={m}
                  loading={adding.has(m.id)}
                  added={added.has(m.id)}
                  onAdd={() => addToLeadStack(m)}
                />
              ))}
            </div>
          ) : (
            <ListView
              matches={filtered}
              loading={adding}
              added={added}
              onAdd={addToLeadStack}
            />
          )}
        </div>
      </section>
    </div>
  );
}

// ---------- Card ----------
function ProspectCard({
  match: m, loading, added, onAdd,
}: {
  match: Match; loading: boolean; added: boolean; onAdd: () => void;
}) {
  const initials = m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const qualityColor = m.emailQuality === "high" ? "var(--success)"
    : m.emailQuality === "medium" ? "var(--warning)"
    : "var(--danger)";
  return (
    <div
      className="ls-panel p-3.5 transition-colors"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="flex items-start gap-3">
        <span className="ls-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{initials}</span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[13.5px] font-medium leading-tight truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {m.name}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
            {m.title}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <Building2 size={10} /> {m.company}
          </div>
        </div>
        <span
          title={`Email quality: ${m.emailQuality}`}
          style={{
            width: 8, height: 8, borderRadius: 999,
            background: qualityColor, marginTop: 6,
          }}
        />
      </div>

      <div className="flex items-center gap-3 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1"><MapPin size={10} /> {m.location}</span>
        <span style={{ color: "var(--text-ghost)" }}>·</span>
        <span>{m.size} emp</span>
        <span style={{ color: "var(--text-ghost)" }}>·</span>
        <span>{m.funding}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {m.stack.slice(0, 3).map((s) => (
          <span
            key={s}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--border-edge)" }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 mt-1"
        style={{ borderTop: "1px solid var(--border-divider)" }}>
        <span className="text-[10.5px] truncate" style={{ color: "var(--text-secondary)" }}>
          {m.email}
        </span>
        <button
          onClick={onAdd}
          disabled={loading || added}
          className={added ? "ls-btn-ghost" : "ls-btn-amber-outline"}
          style={{ height: 26, fontSize: 11 }}
        >
          {added ? <><CheckCircle2 size={11} /> Added</>
            : loading ? "Adding..."
            : <><Plus size={11} /> Add to LeadStack</>}
        </button>
      </div>
    </div>
  );
}

// ---------- List ----------
function ListView({
  matches, loading, added, onAdd,
}: {
  matches: Match[];
  loading: Set<string | number>;
  added: Set<string | number>;
  onAdd: (m: Match) => void;
}) {
  return (
    <div className="ls-panel overflow-hidden">
      <table className="ls-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Company</th>
            <th>Location</th>
            <th>Stage</th>
            <th>Email</th>
            <th style={{ textAlign: "right" }}></th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="ls-row">
              <td>
                <div className="flex items-center gap-2">
                  <span className="ls-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                    {m.name.split(" ").map((p) => p[0]).slice(0,2).join("")}
                  </span>
                  <span style={{ color: "var(--text-primary)" }}>{m.name}</span>
                </div>
              </td>
              <td>{m.title}</td>
              <td>{m.company}</td>
              <td>{m.location}</td>
              <td>
                <span className="ls-badge ls-bare ls-badge-amber">{m.funding}</span>
              </td>
              <td className="ls-num text-[11.5px]" style={{ color: "var(--text-secondary)" }}>{m.email}</td>
              <td style={{ textAlign: "right" }}>
                <button
                  onClick={() => onAdd(m)}
                  disabled={loading.has(m.id) || added.has(m.id)}
                  className={added.has(m.id) ? "ls-btn-ghost" : "ls-btn-amber-outline"}
                  style={{ height: 26, fontSize: 11 }}
                >
                  {added.has(m.id) ? <><CheckCircle2 size={11} /> Added</>
                    : loading.has(m.id) ? "Adding..."
                    : <><Plus size={11} /> Add</>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
