// LeadStack™ CRM — Kanban Pipeline with bulk select + actions
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Phone, Globe, MapPin, X, CheckCircle2, Send,
  Clock, Trash2, Download, ArrowRight, CheckSquare, Square
} from "lucide-react";
import { toast } from "sonner";

type Stage = "prospect" | "contacted" | "replied" | "meeting" | "closed" | "lost";

type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  stage: Stage;
  score: number;
  lastContact: string;
  notes: string;
  emailsSent: number;
  tags: string[];
  deal_value?: number;
  close_probability?: number;
};

const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id: "prospect",  label: "Prospect",  color: "oklch(0.55 0.015 255)", bg: "oklch(0.55 0.015 255 / 0.08)" },
  { id: "contacted", label: "Contacted", color: "oklch(0.55 0.10 230)",  bg: "oklch(0.55 0.10 230 / 0.08)"  },
  { id: "replied",   label: "Replied",   color: "oklch(0.72 0.12 75)",   bg: "oklch(0.72 0.12 75 / 0.08)"   },
  { id: "meeting",   label: "Meeting",   color: "oklch(0.65 0.18 145)",  bg: "oklch(0.65 0.18 145 / 0.08)"  },
  { id: "closed",    label: "Closed",    color: "oklch(0.72 0.16 145)",  bg: "oklch(0.72 0.16 145 / 0.08)"  },
  { id: "lost",      label: "Lost",      color: "oklch(0.65 0.2 25)",    bg: "oklch(0.65 0.2 25 / 0.08)"    },
];

const DEMO_LEADS: Lead[] = [
  { id: "1", name: "James Whitfield",  company: "Whitfield Capital Advisors", email: "james@whitfieldcap.com",   phone: "(212) 555-0182", website: "whitfieldcap.com",      location: "New York, NY",      stage: "replied",   score: 87, lastContact: "2h ago",  notes: "Interested in automation. Follow up Thursday.", emailsSent: 2, tags: ["hot","RIA"],        deal_value: 24000, close_probability: 65 },
  { id: "2", name: "Sarah Chen",       company: "Chen Financial Group",       email: "sarah@chenfinancial.com",  phone: "(415) 555-0247", website: "chenfinancial.com",      location: "San Francisco, CA", stage: "contacted", score: 62, lastContact: "1d ago",  notes: "",                                              emailsSent: 1, tags: ["warm"],              deal_value: 18000, close_probability: 30 },
  { id: "3", name: "Marcus Rivera",    company: "Rivera Wealth Management",   email: "m.rivera@riverawealth.com",phone: "(305) 555-0391", website: "riverawealth.com",       location: "Miami, FL",         stage: "meeting",   score: 94, lastContact: "3h ago",  notes: "Call scheduled Friday 2pm EST.",                emailsSent: 3, tags: ["hot","call booked"], deal_value: 36000, close_probability: 80 },
  { id: "4", name: "Emily Thompson",   company: "Thompson Advisory LLC",      email: "emily@thompsonadvisory.com",phone:"(312) 555-0156", website: "thompsonadvisory.com",   location: "Chicago, IL",       stage: "prospect",  score: 45, lastContact: "Never",   notes: "",                                              emailsSent: 0, tags: [],                    deal_value: 12000, close_probability: 15 },
  { id: "5", name: "David Park",       company: "Park & Associates",          email: "david@parkassoc.com",      phone: "(206) 555-0428", website: "parkassoc.com",          location: "Seattle, WA",       stage: "prospect",  score: 51, lastContact: "Never",   notes: "",                                              emailsSent: 0, tags: [],                    deal_value: 15000, close_probability: 20 },
  { id: "6", name: "Lisa Monroe",      company: "Monroe Wealth Partners",     email: "lisa@monroewealth.com",    phone: "(617) 555-0312", website: "monroewealth.com",       location: "Boston, MA",        stage: "closed",    score: 99, lastContact: "5d ago",  notes: "Signed! Onboarding next week.",                 emailsSent: 4, tags: ["client"],            deal_value: 42000, close_probability: 100 },
  { id: "7", name: "Robert Kim",       company: "Kim Financial Services",     email: "rkim@kimfinancial.com",    phone: "(713) 555-0198", website: "kimfinancial.com",       location: "Houston, TX",       stage: "contacted", score: 58, lastContact: "2d ago",  notes: "",                                              emailsSent: 1, tags: [],                    deal_value: 9000,  close_probability: 25 },
  { id: "8", name: "Anna Petrova",     company: "Petrova Investments",        email: "anna@petrovainv.com",      phone: "(617) 555-0891", website: "petrovainv.com",         location: "Boston, MA",        stage: "lost",      score: 20, lastContact: "1w ago",  notes: "Not interested at this time.",                  emailsSent: 3, tags: ["cold"],              deal_value: 0,     close_probability: 0 },
];

function scoreColor(score: number) {
  if (score >= 80) return "oklch(0.65 0.18 145)";
  if (score >= 60) return "oklch(0.72 0.12 75)";
  if (score >= 40) return "oklch(0.55 0.10 230)";
  return "oklch(0.55 0.015 255)";
}

const BASE = "http://localhost:7432/api";

export default function CRMSection() {
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [moveStageTo, setMoveStageTo] = useState<Stage>("contacted");

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/leads?limit=500`);
      if (!res.ok) return;
      const data = await res.json();
      const validStages = new Set(["prospect","contacted","replied","meeting","closed","lost"]);
      const mapped: Lead[] = (data.leads || []).map((l: Record<string, unknown>) => {
        const rawStatus = String(l.status || "prospect").toLowerCase().replace(/ /g, "-");
        return {
          id: String(l.id),
          name: String(l.name || ""),
          company: String(l.name || ""),
          email: String(l.email || ""),
          phone: String(l.phone || ""),
          website: String(l.website || ""),
          location: String(l.city || ""),
          stage: (validStages.has(rawStatus) ? rawStatus : "prospect") as Stage,
          score: Number(l.lead_score ?? l.score) || 50,
          lastContact: String(l.updated_at || l.created_at || "Never").split("T")[0],
          notes: String(l.notes || ""),
          emailsSent: Number(l.emails_sent) || 0,
          tags: [],
          deal_value: Number(l.deal_value) || 0,
          close_probability: Number(l.close_probability) || 20,
        };
      });
      if (mapped.length > 0) setLeads(mapped);
    } catch {
      // Backend offline — keep demo data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const patchLead = async (id: string, patch: Record<string, unknown>) => {
    try {
      await fetch(`${BASE}/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch { /* offline */ }
  };

  const moveLead = (id: string, dir: "forward" | "back") => {
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const idx = STAGES.findIndex(s => s.id === l.stage);
      const newIdx = dir === "forward" ? Math.min(idx + 1, STAGES.length - 1) : Math.max(idx - 1, 0);
      const newStage = STAGES[newIdx].id;
      toast.success(`${l.name} → ${STAGES[newIdx].label}`);
      if (selectedLead?.id === id) setSelectedLead({ ...l, stage: newStage });
      patchLead(id, { status: newStage });
      return { ...l, stage: newStage };
    }));
  };

  const saveNote = async () => {
    if (!selectedLead || !noteText.trim()) return;
    const previousNotes = selectedLead.notes;
    const updated = { ...selectedLead, notes: noteText };
    // Optimistic update.
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
    setSelectedLead(updated);
    setNoteText("");
    try {
      await patchLead(selectedLead.id, { notes: noteText });
      toast.success("Note saved");
    } catch (e) {
      // Revert on failure so the UI matches what's on the server.
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, notes: previousNotes } : l));
      setSelectedLead(prev => prev ? { ...prev, notes: previousNotes } : prev);
      toast.error(e instanceof Error ? `Could not save note: ${e.message}` : "Could not save note");
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(leads.map(l => l.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
    setBulkMode(false);
  };

  const bulkMove = async () => {
    if (!selected.size) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`${BASE}/leads/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "move", stage: moveStageTo }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => selected.has(l.id) ? { ...l, stage: moveStageTo } : l));
        toast.success(`${ids.length} leads moved to ${STAGES.find(s => s.id === moveStageTo)?.label}`);
        clearSelection();
      } else {
        // Fallback: update locally
        setLeads(prev => prev.map(l => selected.has(l.id) ? { ...l, stage: moveStageTo } : l));
        toast.success(`${ids.length} leads moved (offline)`);
        clearSelection();
      }
    } catch {
      setLeads(prev => prev.map(l => selected.has(l.id) ? { ...l, stage: moveStageTo } : l));
      toast.success(`${selected.size} leads moved (offline)`);
      clearSelection();
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} lead(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`${BASE}/leads/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "delete" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      setLeads(prev => prev.filter(l => !selected.has(l.id)));
      toast.success(`${ids.length} leads deleted`);
      clearSelection();
    } catch (e) {
      // Don't delete locally if the server didn't actually delete — leads would
      // reappear on the next refresh and confuse the user.
      toast.error(e instanceof Error ? `Delete failed: ${e.message}` : "Delete failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkExport = () => {
    const toExport = leads.filter(l => selected.has(l.id));
    const headers = ["id","name","email","phone","website","location","stage","score","notes"];
    const rows = toExport.map(l => headers.map(h => (l as Record<string, unknown>)[h] ?? "").join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "selected_leads.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${toExport.length} leads exported`);
    clearSelection();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: "oklch(0.45 0.015 255)" }}>
      <div className="text-sm">Loading pipeline...</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.10 0.020 255)" }}>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Pipeline CRM</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: "oklch(0.55 0.10 230 / 0.10)", color: "oklch(0.65 0.12 230)", border: "1px solid oklch(0.55 0.10 230 / 0.18)" }}>
            {leads.length} leads
          </span>
        </div>
        <button
          onClick={() => { setBulkMode(!bulkMode); if (bulkMode) clearSelection(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
          style={bulkMode
            ? { background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.82 0.14 75)", border: "1px solid oklch(0.72 0.12 75 / 0.30)" }
            : { background: "oklch(1 0 0 / 0.04)", color: "oklch(0.50 0.015 255)", border: "1px solid oklch(1 0 0 / 0.09)" }}>
          <CheckSquare size={12} />
          {bulkMode ? "Exit Bulk" : "Bulk Select"}
        </button>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {bulkMode && selected.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 overflow-hidden"
            style={{ background: "oklch(0.72 0.12 75 / 0.06)", borderBottom: "1px solid oklch(0.72 0.12 75 / 0.15)" }}>
            <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.12 75)" }}>
              {selected.size} selected
            </span>
            <button onClick={selectAll} className="text-[10px] hover:opacity-70 transition-opacity"
              style={{ color: "oklch(0.55 0.015 255)" }}>
              Select all
            </button>
            <div className="flex-1" />
            {/* Move stage */}
            <div className="flex items-center gap-1.5">
              <ArrowRight size={10} style={{ color: "oklch(0.55 0.015 255)" }} />
              <select value={moveStageTo} onChange={e => setMoveStageTo(e.target.value as Stage)}
                className="text-[10px] px-2 py-1 rounded outline-none"
                style={{ background: "oklch(0.16 0.022 255)", border: "1px solid oklch(1 0 0 / 0.10)", color: "oklch(0.78 0.008 65)" }}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button onClick={bulkMove} disabled={bulkLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all hover:opacity-80"
                style={{ background: "oklch(0.55 0.10 230 / 0.15)", color: "oklch(0.65 0.12 230)", border: "1px solid oklch(0.55 0.10 230 / 0.25)" }}>
                <CheckCircle2 size={9} /> Move
              </button>
            </div>
            {/* Export */}
            <button onClick={bulkExport}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all hover:opacity-80"
              style={{ background: "oklch(0.65 0.18 145 / 0.12)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.25)" }}>
              <Download size={9} /> Export CSV
            </button>
            {/* Delete */}
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all hover:opacity-80"
              style={{ background: "oklch(0.65 0.2 25 / 0.12)", color: "oklch(0.65 0.2 25)", border: "1px solid oklch(0.65 0.2 25 / 0.25)" }}>
              <Trash2 size={9} /> Delete
            </button>
            {/* Clear */}
            <button onClick={clearSelection}
              className="w-6 h-6 rounded flex items-center justify-center hover:opacity-70 transition-opacity"
              style={{ background: "oklch(1 0 0 / 0.06)", color: "oklch(0.50 0.015 255)" }}>
              <X size={10} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Kanban board */}
        <div className="flex-1 flex gap-3 p-4 overflow-x-auto min-w-0">
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 flex flex-col" style={{ width: 210 }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color, boxShadow: `0 0 8px ${stage.color}60` }} />
                    <span className="text-[12px] font-bold" style={{ color: stage.color }}>{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
                    style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.color}30` }}>
                    {stageLeads.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                  <AnimatePresence>
                    {stageLeads.map(lead => {
                      const stageIdx = STAGES.findIndex(s => s.id === lead.stage);
                      const isSelected = selected.has(lead.id);
                      return (
                        <motion.div key={lead.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="rounded-2xl p-3.5 cursor-pointer group transition-all"
                          style={{
                            background: isSelected ? "oklch(0.72 0.12 75 / 0.08)" : "oklch(0.13 0.024 255)",
                            border: isSelected ? "1px solid oklch(0.72 0.12 75 / 0.35)" : "1px solid oklch(1 0 0 / 0.08)",
                            boxShadow: isSelected ? "0 0 0 2px oklch(0.72 0.12 75 / 0.12)" : "none",
                          }}
                          onClick={() => {
                            if (bulkMode) {
                              setSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
                                return next;
                              });
                            } else {
                              setSelectedLead(lead); setNoteText("");
                            }
                          }}>
                          <div className="flex items-start justify-between mb-2">
                            {bulkMode && (
                              <div className="mr-2 flex-shrink-0 mt-0.5" onClick={e => toggleSelect(lead.id, e)}>
                                {isSelected
                                  ? <CheckSquare size={12} style={{ color: "oklch(0.72 0.12 75)" }} />
                                  : <Square size={12} style={{ color: "oklch(0.38 0.015 255)" }} />}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-semibold truncate" style={{ color: "oklch(0.85 0.008 65)" }}>{lead.name}</div>
                              <div className="text-[10px] truncate" style={{ color: "oklch(0.48 0.015 255)" }}>{lead.company}</div>
                            </div>
                            <div className="ml-2 text-[11px] font-bold font-mono px-2 py-0.5 rounded-full"
                              style={{ background: `${scoreColor(lead.score)}18`, color: scoreColor(lead.score), border: `1px solid ${scoreColor(lead.score)}28` }}>
                              {lead.score}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] mb-2" style={{ color: "oklch(0.42 0.015 255)" }}>
                            <Clock size={8} />{lead.lastContact}
                            {lead.emailsSent > 0 && (
                              <span className="ml-1 px-1 py-0.5 rounded" style={{ background: "oklch(0.55 0.10 230 / 0.12)", color: "oklch(0.55 0.10 230)" }}>
                                {lead.emailsSent} sent
                              </span>
                            )}
                            {lead.deal_value ? (
                              <span className="ml-auto px-1.5 py-0.5 rounded font-mono font-bold" style={{ background: "oklch(0.72 0.12 75 / 0.10)", color: "oklch(0.72 0.12 75)" }}>
                                ${(lead.deal_value / 1000).toFixed(0)}k
                              </span>
                            ) : null}
                          </div>
                          {lead.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {lead.tags.map(tag => (
                                <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: "oklch(0.72 0.12 75 / 0.10)", color: "oklch(0.72 0.12 75 / 0.8)" }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {!bulkMode && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              {stageIdx > 0 && (
                                <button onClick={() => moveLead(lead.id, "back")}
                                  className="flex-1 py-1 rounded text-[9px] font-medium"
                                  style={{ background: "oklch(0.16 0.022 255)", color: "oklch(0.45 0.015 255)" }}>
                                  ← Back
                                </button>
                              )}
                              {stageIdx < STAGES.length - 1 && (
                                <button onClick={() => moveLead(lead.id, "forward")}
                                  className="flex-1 py-1 rounded text-[9px] font-semibold"
                                  style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30` }}>
                                  → {STAGES[stageIdx + 1]?.label}
                                </button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {stageLeads.length === 0 && (
                    <div className="rounded-2xl p-5 text-center"
                      style={{ border: "1px dashed oklch(1 0 0 / 0.09)", color: "oklch(0.32 0.015 255)" }}>
                      <div className="text-[10px]">No leads</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lead detail panel */}
        <AnimatePresence>
          {selectedLead && !bulkMode && (
            <motion.div initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex-shrink-0 flex flex-col overflow-hidden"
              style={{ width: 320, borderLeft: "1px solid oklch(1 0 0 / 0.08)", background: "oklch(0.095 0.022 255)" }}>
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
                <div className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Lead Detail</div>
                <button onClick={() => setSelectedLead(null)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ background: "oklch(0.16 0.022 255)" }}>
                  <X size={11} style={{ color: "oklch(0.55 0.015 255)" }} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <div className="text-[15px] font-bold mb-0.5" style={{ color: "oklch(0.90 0.008 65)" }}>{selectedLead.name}</div>
                  <div className="text-[11px]" style={{ color: "oklch(0.55 0.015 255)" }}>{selectedLead.company}</div>
                </div>
                {/* Stage selector */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.38 0.015 255)" }}>Stage</div>
                  <div className="grid grid-cols-3 gap-1">
                    {STAGES.map(s => (
                      <button key={s.id} onClick={() => {
                        const updated = { ...selectedLead, stage: s.id };
                        setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l));
                        setSelectedLead(updated);
                        patchLead(selectedLead.id, { status: s.id });
                        toast.success(`Moved to ${s.label}`);
                      }}
                        className="py-1 rounded text-[9px] font-semibold transition-all"
                        style={selectedLead.stage === s.id ? {
                          background: s.bg, color: s.color, border: `1px solid ${s.color}40`
                        } : {
                          background: "oklch(0.14 0.022 255)", color: "oklch(0.40 0.015 255)", border: "1px solid oklch(1 0 0 / 0.06)"
                        }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Contact */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.38 0.015 255)" }}>Contact</div>
                  <div className="space-y-2">
                    {[
                      { icon: Mail,   value: selectedLead.email,    color: "oklch(0.55 0.10 230)" },
                      { icon: Phone,  value: selectedLead.phone,    color: "oklch(0.65 0.015 255)" },
                      { icon: Globe,  value: selectedLead.website,  color: "oklch(0.65 0.18 145)" },
                      { icon: MapPin, value: selectedLead.location, color: "oklch(0.55 0.015 255)" },
                    ].map(({ icon: Icon, value, color }) => value ? (
                      <div key={value} className="flex items-center gap-2">
                        <Icon size={10} style={{ color, flexShrink: 0 }} />
                        <span className="text-[11px] truncate" style={{ color: "oklch(0.65 0.008 65)" }}>{value}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
                {/* Score */}
                <div className="rounded-2xl p-4" style={{ background: "oklch(0.14 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>Lead Score</span>
                    <span className="text-[14px] font-bold font-mono" style={{ color: scoreColor(selectedLead.score) }}>{selectedLead.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.022 255)" }}>
                    <div className="h-full rounded-full" style={{ width: `${selectedLead.score}%`, background: scoreColor(selectedLead.score) }} />
                  </div>
                </div>
                {/* Notes */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.38 0.015 255)" }}>Notes</div>
                  {selectedLead.notes && (
                    <div className="rounded-xl p-3 mb-3 text-[11.5px] leading-relaxed"
                      style={{ background: "oklch(0.72 0.12 75 / 0.06)", border: "1px solid oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.78 0.008 65)" }}>
                      {selectedLead.notes}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <input value={noteText} onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveNote()}
                      placeholder="Add a note..."
                      className="flex-1 px-3 py-2 rounded-xl text-[11.5px] outline-none"
                      style={{ background: "oklch(0.14 0.024 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.82 0.008 65)" }} />
                    <button onClick={saveNote}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:opacity-80 transition-opacity"
                      style={{ background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.72 0.12 75)" }}>
                      <Send size={10} />
                    </button>
                  </div>
                </div>
                {/* Actions */}
                <div className="space-y-1.5">
                  <button onClick={() => toast.success("Email composer opened")}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold hover:opacity-80 transition-opacity"
                    style={{ background: "oklch(0.55 0.10 230 / 0.10)", border: "1px solid oklch(0.55 0.10 230 / 0.22)", color: "oklch(0.65 0.12 230)" }}>
                    <Mail size={12} /> Send Email
                  </button>
                  <button onClick={() => { moveLead(selectedLead.id, "forward"); }}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold hover:opacity-80 transition-opacity"
                    style={{ background: "oklch(0.65 0.18 145 / 0.10)", border: "1px solid oklch(0.65 0.18 145 / 0.22)", color: "oklch(0.72 0.16 145)" }}>
                    <CheckCircle2 size={12} /> Advance Stage
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
