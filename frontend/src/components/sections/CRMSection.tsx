// LeadStack — Pipeline Kanban + Lead Detail (Blocks 3 + 5)
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail, Phone, Globe, Linkedin, X, Send, Trash2, Plus, MoreHorizontal,
  ChevronRight, Search, Flame, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";

type Stage = "prospect" | "contacted" | "qualified" | "proposal" | "negotiation" | "closed";

const STAGES: { id: Stage; label: string; accent: string }[] = [
  { id: "prospect",    label: "Prospect",    accent: "#a1a09c" },
  { id: "contacted",   label: "Contacted",   accent: "#60a5fa" },
  { id: "qualified",   label: "Qualified",   accent: "#f59e0b" },
  { id: "proposal",    label: "Proposal",    accent: "#a855f7" },
  { id: "negotiation", label: "Negotiation", accent: "#fbbf24" },
  { id: "closed",      label: "Closed Won",  accent: "#4ade80" },
];

type Lead = {
  id: string;
  name: string;
  company: string;
  title?: string;
  email: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  location?: string;
  stage: Stage;
  score: number;
  daysInStage: number;
  dealValue: number;
  emailsSent: number;
  notes: string;
  source?: string;
  lastActivity?: string;
};

const DEMO_LEADS: Lead[] = [
  { id: "1", name: "Sarah Okonkwo",   company: "Brightside SaaS", title: "Head of Growth",     email: "sarah@brightside.io",  phone: "(415) 555-0247", website: "brightside.io",   linkedin: "linkedin.com/in/sokonkwo",  location: "San Francisco, CA", stage: "qualified",  score: 82, daysInStage: 7,  dealValue: 18000, emailsSent: 2, notes: "Engaged on first email. Wants demo next week.",     source: "LinkedIn",    lastActivity: "Today" },
  { id: "2", name: "Marcus Chen",     company: "Vertex Analytics", title: "CTO",                email: "m.chen@vertex.io",      phone: "(212) 555-0182", website: "vertex.io",       linkedin: "linkedin.com/in/mchen",     location: "Austin, TX",        stage: "contacted",  score: 61, daysInStage: 3,  dealValue: 7500,  emailsSent: 1, notes: "",                                                  source: "Cold Email",  lastActivity: "Yesterday" },
  { id: "3", name: "Priya Kapoor",    company: "NovaFlow Inc.",   title: "VP of Engineering",  email: "priya@novaflow.io",     phone: "(415) 882-0391", website: "novaflow.io",     linkedin: "linkedin.com/in/priyakapoor", location: "New York, NY",     stage: "qualified",  score: 91, daysInStage: 2,  dealValue: 32000, emailsSent: 3, notes: "Replied positive. Joined webinar Apr 18.",          source: "Webinar",     lastActivity: "1h ago" },
  { id: "4", name: "Tom Reilly",      company: "Cascade Digital", title: "Founder",            email: "tom@cascade.dev",       phone: "(206) 555-0428", website: "cascade.dev",     linkedin: "linkedin.com/in/treilly",   location: "Seattle, WA",       stage: "prospect",   score: 44, daysInStage: 1,  dealValue: 5200,  emailsSent: 0, notes: "",                                                  source: "Referral",    lastActivity: "Apr 23" },
  { id: "5", name: "Anita Ruiz",      company: "Helios Group",    title: "Head of Growth",     email: "anita@heliosgroup.com", phone: "(305) 555-0391", website: "heliosgroup.com", linkedin: "linkedin.com/in/aruiz",     location: "Miami, FL",         stage: "prospect",   score: 22, daysInStage: 4,  dealValue: 4800,  emailsSent: 0, notes: "",                                                  source: "LinkedIn",    lastActivity: "Apr 21" },
  { id: "6", name: "David Kim",       company: "Stratum Labs",    title: "CTO",                email: "dkim@stratumlabs.io",   phone: "(617) 555-0312", website: "stratumlabs.io",  linkedin: "linkedin.com/in/dkim",      location: "Boston, MA",        stage: "contacted",  score: 77, daysInStage: 6,  dealValue: 14000, emailsSent: 1, notes: "",                                                  source: "Cold Email",  lastActivity: "Today" },
  { id: "7", name: "Elena Petrov",    company: "Meridian Corp",   title: "VP of Sales",        email: "elena@meridian.co",     phone: "(312) 555-0156", website: "meridian.co",     linkedin: "linkedin.com/in/epetrov",   location: "London, UK",        stage: "proposal",   score: 88, daysInStage: 4,  dealValue: 28000, emailsSent: 4, notes: "Sent proposal Tuesday. Reviewing internally.",     source: "LinkedIn",    lastActivity: "3h ago" },
  { id: "8", name: "James O'Brien",   company: "Apex Systems",    title: "Sales Director",     email: "j.obrien@apex.io",      phone: "(617) 555-0891", website: "apex.io",         linkedin: "linkedin.com/in/jobrien",   location: "Chicago, IL",       stage: "prospect",   score: 35, daysInStage: 18, dealValue: 3100,  emailsSent: 0, notes: "Stalled — try LinkedIn intro.",                    source: "Webinar",     lastActivity: "Apr 20" },
  { id: "9", name: "Fatima Al-Hassan", company: "Nexus Growth",   title: "Head of Growth",     email: "fatima@nexusgrowth.io", phone: "(202) 555-0114", website: "nexusgrowth.io",  linkedin: "linkedin.com/in/fatima-al",  location: "Dubai, UAE",        stage: "negotiation", score: 95, daysInStage: 1, dealValue: 45000, emailsSent: 5, notes: "Final pricing discussion Wednesday.",              source: "Referral",    lastActivity: "1h ago" },
  { id: "10", name: "Ryan Mitchell",  company: "BlueShift Co.",   title: "VP of Engineering",  email: "ryan@blueshift.io",     phone: "(206) 555-0444", website: "blueshift.io",    linkedin: "linkedin.com/in/rmitchell",  location: "Portland, OR",      stage: "contacted",  score: 58, daysInStage: 5,  dealValue: 9200,  emailsSent: 2, notes: "",                                                  source: "Cold Email",  lastActivity: "Apr 22" },
  { id: "11", name: "Lin Park",       company: "Ironclad Cyber",  title: "Co-founder",         email: "lin@ironclad.io",       phone: "(415) 555-0992", website: "ironclad.io",     linkedin: "linkedin.com/in/linpark",    location: "San Diego, CA",     stage: "closed",     score: 99, daysInStage: 12, dealValue: 38500, emailsSent: 6, notes: "Closed Apr 15. Implementation kicks off May 2.",  source: "Referral",    lastActivity: "Apr 15" },
];

const BASE = "http://localhost:7432/api";

// Namespaced HTML5 DnD payload so kanban drags can never drop into
// foreign drop zones (sequences, file inputs, etc.).
const DND_TYPE = "application/x-leadstack-lead";

// Tells the shell (Dashboard) to refresh /api/stats so the StatusBar
// and sidebar badges stay in sync after a mutation.
function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent("leadstack:data-changed"));
}

function formatK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function urgencyColor(daysInStage: number, stage: Stage): string {
  if (stage === "closed") return "#4ade80";
  if (daysInStage > 14) return "#f87171";
  if (daysInStage > 7) return "#fbbf24";
  return "#f59e0b";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#60a5fa";
  return "#a1a09c";
}

export default function CRMSection() {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "emails" | "notes">("overview");
  const [noteText, setNoteText] = useState("");
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/leads?limit=500`);
      if (!res.ok) return;
      const data = await res.json();
      const validStages = new Set<Stage>(["prospect","contacted","qualified","proposal","negotiation","closed"]);
      const mapped: Lead[] = (data.leads || []).map((l: any): Lead => {
        const raw = String(l.status || "prospect").toLowerCase().replace(/ /g, "-");
        const stage = (validStages.has(raw as Stage) ? raw : "prospect") as Stage;
        return {
          id: String(l.id),
          name: String(l.name || "Unknown"),
          company: String(l.company || l.name || "—"),
          title: String(l.category || ""),
          email: String(l.email || ""),
          phone: String(l.phone || ""),
          website: String(l.website || ""),
          linkedin: String(l.linkedin || ""),
          location: String(l.city || l.address || ""),
          stage,
          score: Number(l.lead_score ?? l.score ?? 50),
          daysInStage: 1,
          dealValue: Number(l.deal_value ?? 0),
          emailsSent: 0,
          notes: String(l.notes || ""),
          source: "LinkedIn",
          lastActivity: String(l.updated_at || l.created_at || "Today").split("T")[0],
        };
      });
      if (mapped.length) setLeads(mapped);
    } catch { /* offline — keep demo data */ }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStage = useCallback(async (lead: Lead, newStage: Stage) => {
    if (lead.stage === newStage) return;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: newStage, daysInStage: 0 } : l)));
    if (selected?.id === lead.id) {
      setSelected((s) => (s ? { ...s, stage: newStage } : s));
    }
    try {
      await fetch(`${BASE}/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStage }),
      });
      toast.success(`${lead.name} → ${STAGES.find((s) => s.id === newStage)?.label}`);
      notifyDataChanged();
    } catch {
      toast.info(`${lead.name} moved (offline — will sync later)`);
    }
  }, [selected]);

  const saveNote = useCallback(async () => {
    if (!selected || !noteText.trim()) return;
    const note = noteText.trim();
    const prevNotes = selected.notes;
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, notes: note } : l)));
    setSelected((s) => (s ? { ...s, notes: note } : s));
    setNoteText("");
    try {
      const res = await fetch(`${BASE}/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: note }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("Note saved");
    } catch (e) {
      // Revert on failure so we don't lie about persistence.
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, notes: prevNotes } : l)));
      setSelected((s) => (s ? { ...s, notes: prevNotes } : s));
      toast.error(e instanceof Error ? `Save failed: ${e.message}` : "Save failed");
    }
  }, [selected, noteText]);

  const deleteLead = useCallback(async (lead: Lead) => {
    if (!window.confirm(`Delete ${lead.name}? This can't be undone.`)) return;
    const before = leads;
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    if (selected?.id === lead.id) setSelected(null);
    try {
      const res = await fetch(`${BASE}/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(`Deleted ${lead.name}`);
      notifyDataChanged();
    } catch (e) {
      // Restore on failure.
      setLeads(before);
      toast.error(e instanceof Error ? `Delete failed: ${e.message}` : "Delete failed");
    }
  }, [leads, selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q),
    );
  }, [leads, search]);

  const totals = useMemo(() => {
    const sum = filtered.reduce((s, l) => s + l.dealValue, 0);
    const wonValue = filtered.filter((l) => l.stage === "closed").reduce((s, l) => s + l.dealValue, 0);
    const weighted = Math.round(sum * 0.37);
    return { sum, weighted, wonValue, totalLeads: filtered.length };
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      {/* Action bar */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border-divider)" }}>
        <div className="relative flex-1 max-w-[340px]">
          <Search size={12} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: 9 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads, companies, emails..."
            className="ls-input"
            style={{ width: "100%", paddingLeft: 28, height: 30, fontSize: 12 }}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span><span className="ls-num" style={{ color: "var(--text-primary)" }}>{totals.totalLeads}</span> leads</span>
          <span style={{ color: "var(--text-ghost)" }}>·</span>
          <span>Pipeline <span className="ls-num" style={{ color: "var(--amber-text)" }}>{formatK(totals.sum)}</span></span>
          <span style={{ color: "var(--text-ghost)" }}>·</span>
          <span>Weighted <span className="ls-num" style={{ color: "var(--text-primary)" }}>{formatK(totals.weighted)}</span></span>
          <span style={{ color: "var(--text-ghost)" }}>·</span>
          <span>Won <span className="ls-num" style={{ color: "#4ade80" }}>{formatK(totals.wonValue)}</span></span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="ls-btn-ghost"><Plus size={12} /> New lead</button>
        </div>
      </div>

      {/* Split pane: kanban / detail */}
      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden"
          style={{ background: "var(--bg-base)" }}
        >
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <div
                style={{
                  width: 48, height: 48, borderRadius: 11,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Plus size={20} color="var(--amber-text)" />
              </div>
              <div className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                No leads in your pipeline yet
              </div>
              <div className="text-[12px]" style={{ color: "var(--text-muted)", maxWidth: 360 }}>
                Add your first lead manually, scrape one from Google Maps, or use Prospector to find target accounts in your ICP.
              </div>
              <div className="flex gap-2 mt-1">
                <button className="ls-btn-primary"><Plus size={12} /> Add lead</button>
                <button className="ls-btn-ghost">Open Prospector</button>
              </div>
            </div>
          ) : (
          <div className="flex h-full px-4 py-4 gap-3 min-w-max">
            {STAGES.map((stage) => {
              const colLeads = filtered.filter((l) => l.stage === stage.id);
              const colValue = colLeads.reduce((s, l) => s + l.dealValue, 0);
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => {
                    // Only accept our own kanban payload — guards against
                    // stray drops (files, links, drags from other panes).
                    if (e.dataTransfer.types.includes(DND_TYPE)) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData(DND_TYPE) || draggingId;
                    if (!id) return;
                    const lead = leads.find((l) => l.id === id);
                    if (lead) updateStage(lead, stage.id);
                    setDraggingId(null);
                  }}
                  style={{
                    width: 240,
                    flexShrink: 0,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-divider)",
                    borderRadius: 9,
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "100%",
                  }}
                >
                  {/* Column header */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-2"
                    style={{
                      borderBottom: `1px solid ${stage.accent}30`,
                      borderTop: `2px solid ${stage.accent}`,
                      borderTopLeftRadius: 9,
                      borderTopRightRadius: 9,
                    }}
                  >
                    <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {stage.label}
                    </span>
                    <span className="ls-badge ls-bare ls-badge-muted">{colLeads.length}</span>
                    <span className="ml-auto text-[11px] ls-num" style={{ color: stage.accent }}>
                      {formatK(colValue)}
                    </span>
                    <button className="opacity-50 hover:opacity-100" aria-label="Stage options">
                      <MoreHorizontal size={12} color="var(--text-muted)" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div
                    className="flex-1 overflow-y-auto px-2 py-2 space-y-2"
                  >
                    {colLeads.length === 0 ? (
                      <div
                        className="flex flex-col items-center justify-center py-8 gap-2 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="text-[10.5px]">No leads in this stage</span>
                      </div>
                    ) : (
                      colLeads.map((l) => (
                        <KanbanCard
                          key={l.id}
                          lead={l}
                          isSelected={selected?.id === l.id}
                          onClick={() => setSelected(l)}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DND_TYPE, l.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(l.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                        />
                      ))
                    )}
                    <button
                      className="w-full flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-md"
                      style={{
                        color: "var(--text-muted)",
                        border: "1px dashed var(--border-edge)",
                        background: "transparent",
                      }}
                    >
                      <Plus size={11} /> Add lead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <LeadDetail
            lead={selected}
            onClose={() => setSelected(null)}
            onStageChange={(stage) => updateStage(selected, stage)}
            onDelete={() => deleteLead(selected)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            noteText={noteText}
            onNoteChange={setNoteText}
            onNoteSave={saveNote}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Kanban Card ----------
function KanbanCard({
  lead, isSelected, onClick, onDragStart, onDragEnd,
}: {
  lead: Lead;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const initials = lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const urgent = urgencyColor(lead.daysInStage, lead.stage);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="cursor-pointer transition-colors"
      style={{
        background: isSelected ? "var(--amber-soft)" : "var(--bg-panel)",
        border: `1px solid ${isSelected ? "rgba(245,158,11,0.4)" : "var(--border-edge)"}`,
        borderLeft: `3px solid ${urgent}`,
        borderRadius: 7,
        padding: "10px 11px",
        display: "flex", flexDirection: "column", gap: 7,
      }}
    >
      <div className="flex items-start gap-2">
        <span className="ls-avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{initials}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium leading-tight truncate" style={{ color: "var(--text-primary)" }}>
            {lead.name}
          </div>
          <div className="text-[10.5px] truncate" style={{ color: "var(--text-secondary)" }}>
            {lead.company}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] ls-num" style={{ color: "var(--amber-text)", fontWeight: 600 }}>
          {formatK(lead.dealValue)}
        </span>
        <div className="ls-score-bar flex-1">
          <span style={{ width: `${lead.score}%`, background: scoreColor(lead.score) }} />
        </div>
        <span className="text-[10px] ls-num" style={{ color: scoreColor(lead.score) }}>{lead.score}</span>
      </div>

      <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <Clock size={9} /> {lead.daysInStage}d in stage
        </span>
        <span className="ls-num">{lead.lastActivity}</span>
      </div>
    </div>
  );
}

// ---------- Detail Panel ----------
function LeadDetail({
  lead, onClose, onStageChange, onDelete,
  activeTab, onTabChange,
  noteText, onNoteChange, onNoteSave,
}: {
  lead: Lead;
  onClose: () => void;
  onStageChange: (s: Stage) => void;
  onDelete: () => void;
  activeTab: "overview" | "activity" | "emails" | "notes";
  onTabChange: (t: "overview" | "activity" | "emails" | "notes") => void;
  noteText: string;
  onNoteChange: (v: string) => void;
  onNoteSave: () => void;
}) {
  const initials = lead.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <aside
      style={{
        width: 420, flexShrink: 0,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-divider)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--border-divider)" }}>
        <div className="flex items-start gap-3">
          <span className="ls-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>{initials}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
                {lead.name}
              </span>
              {lead.score >= 85 && (
                <span className="ls-badge ls-badge-danger" style={{ fontSize: 10 }}>
                  <Flame size={9} /> Hot
                </span>
              )}
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
              {lead.title} · {lead.company}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="ls-num text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                Score
              </span>
              <span className="ls-num text-[11px]" style={{ color: scoreColor(lead.score), fontWeight: 600 }}>
                {lead.score}
              </span>
              <select
                value={lead.stage}
                onChange={(e) => onStageChange(e.target.value as Stage)}
                className="ls-input ls-num"
                style={{ height: 24, fontSize: 11, padding: "0 8px" }}
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="opacity-60 hover:opacity-100">
            <X size={14} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Contact strip */}
        <div className="grid grid-cols-2 gap-1 mt-3 text-[11px]">
          <ContactRow icon={Mail}     label={lead.email} />
          <ContactRow icon={Phone}    label={lead.phone || "—"} />
          <ContactRow icon={Globe}    label={lead.website || "—"} />
          <ContactRow icon={Linkedin} label={lead.linkedin?.replace("linkedin.com/in/", "") || "—"} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button className="ls-btn-primary flex-1"><Send size={12} /> Send Email</button>
          <button className="ls-btn-ghost"><Phone size={12} /> Log Call</button>
          <button className="ls-btn-ghost" onClick={onDelete} aria-label="Delete lead">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--border-divider)" }}>
        {(["overview", "activity", "emails", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className="text-[11.5px] capitalize"
            style={{
              flex: 1,
              padding: "9px 0",
              color: activeTab === t ? "var(--amber-text)" : "var(--text-secondary)",
              borderBottom: `2px solid ${activeTab === t ? "var(--amber)" : "transparent"}`,
              background: "transparent",
              fontWeight: activeTab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeTab === "overview" && <OverviewTab lead={lead} />}
        {activeTab === "activity" && <ActivityTab lead={lead} />}
        {activeTab === "emails"   && <EmailsTab   lead={lead} />}
        {activeTab === "notes"    && (
          <NotesTab
            notes={lead.notes}
            value={noteText}
            onChange={onNoteChange}
            onSave={onNoteSave}
          />
        )}
      </div>
    </aside>
  );
}

function ContactRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span
      className="flex items-center gap-1.5 truncate"
      style={{ color: "var(--text-secondary)" }}
    >
      <Icon size={11} color="var(--text-muted)" />
      <span className="truncate ls-num" style={{ color: "var(--text-primary)" }}>{label}</span>
    </span>
  );
}

// ---------- Overview tab ----------
function OverviewTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-3">
      <Panel label="Lead Score Breakdown">
        {[
          { l: "Company fit",    v: Math.min(100, lead.score + 8) },
          { l: "Engagement",     v: Math.min(100, lead.score + 4) },
          { l: "Timing",         v: lead.score },
          { l: "ICP match",      v: Math.max(0, lead.score - 6) },
        ].map((row) => (
          <div key={row.l} className="flex items-center gap-2 mb-1.5 text-[11px]">
            <span className="w-24 truncate" style={{ color: "var(--text-secondary)" }}>{row.l}</span>
            <div className="flex-1 ls-score-bar" style={{ width: "100%" }}>
              <span style={{ width: `${row.v}%`, background: scoreColor(row.v) }} />
            </div>
            <span className="ls-num text-[11px]" style={{ color: "var(--text-primary)" }}>{row.v}%</span>
          </div>
        ))}
      </Panel>
      <Panel label="Company">
        <Row label="Industry"  value="SaaS · Growth" />
        <Row label="Size"      value="45 employees" />
        <Row label="Funding"   value="Series A" />
        <Row label="Location"  value={lead.location || "—"} />
      </Panel>
      <Panel label="Source & Owner">
        <Row label="Source" value={lead.source ?? "Unknown"} />
        <Row label="Deal value" value={formatK(lead.dealValue)} highlight />
        <Row label="Days in stage" value={`${lead.daysInStage}d`} />
        <Row label="Assigned to" value="Jake Dawson" />
      </Panel>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ls-panel p-3">
      <div className="ls-section-label" style={{ padding: 0, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-1 text-[11.5px]">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span
        className="ls-num"
        style={{ color: highlight ? "var(--amber-text)" : "var(--text-primary)", fontWeight: highlight ? 600 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------- Activity tab ----------
function ActivityTab({ lead }: { lead: Lead }) {
  const events = [
    { t: "1h ago",     icon: Mail,         color: "#4ade80", text: `Email opened — "${lead.name.split(" ")[0]}, quick question?"` },
    { t: "Today 9:14am", icon: Send,       color: "#f59e0b", text: "Email sent (sequence step 3)" },
    { t: "Apr 23",     icon: CheckCircle2, color: "#4ade80", text: "Email replied (positive intent)" },
    { t: "Apr 22",     icon: Mail,         color: "#60a5fa", text: "Email opened (2nd time)" },
    { t: "Apr 20",     icon: ChevronRight, color: "#a1a09c", text: "Added to 'Webinar Follow-up' sequence" },
    { t: "Apr 18",     icon: Plus,         color: "#a1a09c", text: "Lead created from webinar registration" },
  ];
  return (
    <div className="ls-panel p-3">
      <div className="ls-section-label" style={{ padding: 0, marginBottom: 8 }}>Timeline</div>
      <div className="space-y-3">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div
                style={{
                  width: 22, height: 22, borderRadius: 999,
                  background: `${e.color}18`,
                  border: `1px solid ${e.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={11} color={e.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px]" style={{ color: "var(--text-primary)" }}>{e.text}</div>
                <div className="text-[10px] ls-num" style={{ color: "var(--text-muted)" }}>{e.t}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Emails tab ----------
function EmailsTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-2">
      {[
        { subject: `Quick question, ${lead.name.split(" ")[0]}`, when: "Today 9:14am", status: "opened" },
        { subject: "Following up", when: "Apr 22", status: "replied" },
        { subject: `Hi from LeadStack`, when: "Apr 20", status: "sent" },
      ].map((e, i) => (
        <div key={i} className="ls-panel p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{e.subject}</span>
            <span className="ls-num text-[10.5px]" style={{ color: "var(--text-muted)" }}>{e.when}</span>
          </div>
          <span
            className="ls-badge"
            style={{
              marginTop: 6,
              background: e.status === "opened" ? "rgba(74,222,128,0.10)" : e.status === "replied" ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.04)",
              color: e.status === "opened" ? "#86efac" : e.status === "replied" ? "#fbbf24" : "#a1a09c",
              border: "1px solid var(--border-edge)",
            }}
          >
            {e.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Notes tab ----------
function NotesTab({
  notes, value, onChange, onSave,
}: {
  notes: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="ls-panel p-3">
        <div className="ls-section-label" style={{ padding: 0, marginBottom: 6 }}>Saved note</div>
        <div className="text-[12px]" style={{ color: notes ? "var(--text-primary)" : "var(--text-muted)" }}>
          {notes || "No notes yet."}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder="Add a note... (Enter to save)"
          className="ls-input flex-1"
        />
        <button onClick={onSave} className="ls-btn-primary" disabled={!value.trim()}>
          <Send size={12} /> Save
        </button>
      </div>
    </div>
  );
}
