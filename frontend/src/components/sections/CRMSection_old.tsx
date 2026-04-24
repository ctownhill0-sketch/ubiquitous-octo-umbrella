// LeadStack™ — CRM Section
// Full lead management with real API calls to Python backend
import { motion } from "framer-motion";
import { useState, useCallback } from "react";
import {
  Search, Filter, Download, Star, Phone, Mail, Globe,
  MapPin, ChevronDown, RefreshCw, AlertCircle, ExternalLink
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getLeads, updateLead, exportLeadsCSV, type Lead } from "@/lib/api";
import { toast } from "sonner";

const STATUS_OPTIONS = ["all", "new", "contacted", "replied", "interested", "not_interested", "closed"];
const STATUS_COLORS: Record<string, string> = {
  new: "oklch(0.65 0.18 255)",
  contacted: "oklch(0.72 0.12 75)",
  replied: "oklch(0.72 0.18 142)",
  interested: "oklch(0.75 0.2 45)",
  not_interested: "oklch(0.65 0.2 25)",
  closed: "oklch(0.72 0.18 142)",
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "oklch(0.75 0.2 45)" : score >= 60 ? "oklch(0.72 0.12 75)" : "oklch(0.55 0.015 255)";
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[11px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "oklch(0.55 0.015 255)";
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function CRMSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const LIMIT = 50;

  const fetcher = useCallback(() => getLeads({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: LIMIT,
    offset: page * LIMIT,
  }), [search, statusFilter, page]);

  const { data, loading, error, refetch } = useApi(fetcher, [search, statusFilter, page], {
    fallback: { leads: [], total: 0 }
  });

  const leads = data?.leads ?? [];
  const total = data?.total ?? 0;

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setEditNotes(lead.notes ?? "");
    setEditStatus(lead.status);
  };

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    try {
      await updateLead(selectedLead.id, { notes: editNotes, status: editStatus });
      toast.success("Lead updated.");
      refetch();
      setSelectedLead(null);
    } catch (e) {
      toast.error(`Failed to update: ${e instanceof Error ? e.message : "error"}`);
    }
  };

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>Lead CRM</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>
            {total.toLocaleString()} leads total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "oklch(0.65 0.2 25 / 0.12)", color: "oklch(0.75 0.15 25)", border: "1px solid oklch(0.65 0.2 25 / 0.2)" }}>
              <AlertCircle size={12} />
              Backend offline
            </div>
          )}
          <button onClick={() => exportLeadsCSV()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "oklch(0.72 0.12 75 / 0.1)", color: "oklch(0.72 0.12 75)", border: "1px solid oklch(0.72 0.12 75 / 0.2)" }}>
            <Download size={12} />
            Export CSV
          </button>
          <button onClick={refetch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "oklch(0.13 0.025 255)", color: "oklch(0.75 0.008 65)", border: "1px solid oklch(1 0 0 / 0.1)" }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.015 255)" }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, company, email…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={12} style={{ color: "oklch(0.45 0.015 255)" }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s === "all" ? "All Statuses" : s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex-1 rounded-lg overflow-hidden flex flex-col"
        style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_80px] gap-3 px-4 py-2.5 text-[10px] font-medium flex-shrink-0"
          style={{ color: "oklch(0.45 0.015 255)", borderBottom: "1px solid oklch(1 0 0 / 0.06)", background: "oklch(0.11 0.022 255)" }}>
          <span>BUSINESS</span>
          <span>CONTACT</span>
          <span>LOCATION</span>
          <span>RATING</span>
          <span>STATUS</span>
          <span>SCORE</span>
          <span>ACTIONS</span>
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto">
          {loading && leads.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={20} className="animate-spin" style={{ color: "oklch(0.45 0.015 255)" }} />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Search size={24} style={{ color: "oklch(0.35 0.015 255)", marginBottom: 8 }} />
              <p className="text-xs" style={{ color: "oklch(0.45 0.015 255)" }}>No leads found.</p>
              <p className="text-[10px] mt-1" style={{ color: "oklch(0.35 0.015 255)" }}>
                {error ? "Backend offline — run the Python server first." : "Try scraping some leads first."}
              </p>
            </div>
          ) : (
            leads.map((lead, i) => (
              <motion.div key={lead.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_80px_80px] gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid oklch(1 0 0 / 0.04)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "oklch(1 0 0 / 0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onClick={() => handleSelectLead(lead)}>
                {/* Business */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: "oklch(0.92 0.008 65)" }}>{lead.name}</div>
                  {lead.category && <div className="text-[10px] truncate" style={{ color: "oklch(0.45 0.015 255)" }}>{lead.category}</div>}
                </div>
                {/* Contact */}
                <div className="min-w-0 space-y-0.5">
                  {lead.email && (
                    <div className="flex items-center gap-1 text-[10px] truncate" style={{ color: "oklch(0.65 0.18 255)" }}>
                      <Mail size={9} />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: "oklch(0.72 0.12 75)" }}>
                      <Phone size={9} />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                </div>
                {/* Location */}
                <div className="flex items-center gap-1 text-[10px] truncate" style={{ color: "oklch(0.55 0.015 255)" }}>
                  <MapPin size={9} />
                  <span className="truncate">{lead.address?.split(",").slice(-2).join(",").trim() ?? "—"}</span>
                </div>
                {/* Rating */}
                <div className="flex items-center gap-1 text-[10px]" style={{ color: "oklch(0.75 0.15 75)" }}>
                  <Star size={9} fill="currentColor" />
                  <span className="font-mono">{lead.rating ?? "—"}</span>
                  {lead.reviews && <span style={{ color: "oklch(0.45 0.015 255)" }}>({lead.reviews})</span>}
                </div>
                {/* Status */}
                <div><StatusBadge status={lead.status} /></div>
                {/* Score */}
                <div><ScoreBadge score={lead.score} /></div>
                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {lead.phone && (
                    <button onClick={e => { e.stopPropagation(); window.open(`tel:${lead.phone}`); }}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: "oklch(0.72 0.18 142 / 0.12)", color: "oklch(0.72 0.18 142)" }}>
                      <Phone size={10} />
                    </button>
                  )}
                  {lead.website && (
                    <button onClick={e => { e.stopPropagation(); window.open(lead.website, "_blank"); }}
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: "oklch(0.65 0.18 255 / 0.12)", color: "oklch(0.65 0.18 255)" }}>
                      <ExternalLink size={10} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
            style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
            <span className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>
              Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="text-[10px] px-2 py-1 rounded disabled:opacity-30"
                style={{ background: "oklch(1 0 0 / 0.05)", color: "oklch(0.75 0.008 65)" }}>
                ← Prev
              </button>
              <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}
                className="text-[10px] px-2 py-1 rounded disabled:opacity-30"
                style={{ background: "oklch(1 0 0 / 0.05)", color: "oklch(0.75 0.008 65)" }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 0.7)" }}
          onClick={() => setSelectedLead(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl p-6 space-y-4"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.1)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>{selectedLead.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 255)" }}>{selectedLead.category}</p>
              </div>
              <ScoreBadge score={selectedLead.score} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {selectedLead.email && (
                <div><span style={{ color: "oklch(0.45 0.015 255)" }}>Email: </span>
                  <span style={{ color: "oklch(0.65 0.18 255)" }}>{selectedLead.email}</span></div>
              )}
              {selectedLead.phone && (
                <div><span style={{ color: "oklch(0.45 0.015 255)" }}>Phone: </span>
                  <span style={{ color: "oklch(0.72 0.12 75)" }}>{selectedLead.phone}</span></div>
              )}
              {selectedLead.website && (
                <div><span style={{ color: "oklch(0.45 0.015 255)" }}>Website: </span>
                  <a href={selectedLead.website} target="_blank" rel="noreferrer"
                    style={{ color: "oklch(0.65 0.18 255)" }}>{selectedLead.website.replace(/^https?:\/\//, "")}</a></div>
              )}
              {selectedLead.address && (
                <div className="col-span-2"><span style={{ color: "oklch(0.45 0.015 255)" }}>Address: </span>
                  <span style={{ color: "oklch(0.75 0.008 65)" }}>{selectedLead.address}</span></div>
              )}
              {selectedLead.rating && (
                <div><span style={{ color: "oklch(0.45 0.015 255)" }}>Rating: </span>
                  <span style={{ color: "oklch(0.75 0.15 75)" }}>★ {selectedLead.rating} ({selectedLead.reviews} reviews)</span></div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-medium block mb-1.5" style={{ color: "oklch(0.55 0.015 255)" }}>STATUS</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}>
                {STATUS_OPTIONS.filter(s => s !== "all").map(s => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium block mb-1.5" style={{ color: "oklch(0.55 0.015 255)" }}>NOTES</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                rows={3} placeholder="Add notes about this lead…"
                className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveLead}
                className="flex-1 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.09 0.02 255)" }}>
                Save Changes
              </button>
              <button onClick={() => setSelectedLead(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "oklch(1 0 0 / 0.06)", color: "oklch(0.75 0.008 65)" }}>
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
