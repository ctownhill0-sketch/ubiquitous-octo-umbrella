// LeadStack — Command Palette (Block 4)
// ⌘K-triggered overlay. Fuzzy search across actions + leads.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Plus, Download, Send, BarChart3, GitBranch, Compass,
  LayoutDashboard, Users, Mail, MessageSquare, Settings,
  Linkedin, Flame, Shield, Zap, FileSearch, X,
} from "lucide-react";
import type { SectionId } from "@/components/Sidebar";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: SectionId) => void;
  onAction?: (action: string) => void;
}

type CmdItem = {
  id: string;
  label: string;
  group: "Recent" | "Leads" | "Actions" | "Navigation" | "Settings";
  icon: React.ElementType;
  hint?: string;
  shortcut?: string;
  meta?: string;
  onRun: () => void;
};

type LeadHit = { id: number; name: string; company?: string; lead_score?: number };

export default function CommandPalette({ open, onClose, onNavigate, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on open and reset state.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Live search → backend.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:7432/api/search?q=${encodeURIComponent(query)}&limit=6`
        );
        if (!res.ok) return;
        const data = await res.json();
        const list: LeadHit[] = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.leads) ? data.leads : [];
        setHits(list);
      } catch {
        setHits([]);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const navItem = (id: SectionId, label: string, icon: React.ElementType, shortcut?: string): CmdItem => ({
    id: `nav:${id}`,
    label,
    group: "Navigation",
    icon,
    shortcut,
    onRun: () => { onNavigate(id); onClose(); },
  });

  const actionItem = (id: string, label: string, icon: React.ElementType, shortcut?: string): CmdItem => ({
    id: `action:${id}`,
    label,
    group: "Actions",
    icon,
    shortcut,
    onRun: () => {
      onAction?.(id);
      onClose();
    },
  });

  const items: CmdItem[] = useMemo(() => {
    const base: CmdItem[] = [
      navItem("dashboard", "Dashboard", LayoutDashboard, "⌘1"),
      navItem("crm",       "Leads",      Users,           "⌘2"),
      navItem("analytics", "Pipeline",   BarChart3,       "⌘3"),
      navItem("email",     "Campaigns",  Mail,            "⌘4"),
      navItem("replies",   "Inbox",      MessageSquare,   "⌘5"),
      navItem("prospector", "Prospector", Compass),
      navItem("scraper",   "Scraper",    Search),
      navItem("linkedin",  "LinkedIn",   Linkedin),
      navItem("followup",  "Sequences",  GitBranch),
      navItem("warmup",    "Warmup",     Flame),
      navItem("deliverability", "Deliverability", Shield),
      navItem("settings",  "Settings",   Settings),
      actionItem("new-lead",    "Add new lead",        Plus,        "⌘N"),
      actionItem("export",      "Export selected leads", Download,   "⌘E"),
      actionItem("compose",     "Compose new email",   Send),
      actionItem("new-sequence","Start a new sequence", Zap,         "⌘S"),
      actionItem("research",    "Research a prospect",  FileSearch),
    ];

    const leadHits: CmdItem[] = hits.map((h) => ({
      id: `lead:${h.id}`,
      label: h.name || "Unnamed lead",
      group: "Leads",
      icon: Users,
      meta: h.company,
      hint: typeof h.lead_score === "number" ? `Score ${h.lead_score}` : undefined,
      onRun: () => { onNavigate("crm"); onClose(); },
    }));

    return [...leadHits, ...base];
  }, [hits, onNavigate, onAction, onClose]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(q) || (it.meta || "").toLowerCase().includes(q));
  }, [items, query]);

  // Keep active index inside bounds when results shrink.
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  // Keep refs to mutable inputs the keydown handler reads, so we don't
  // re-attach the listener on every render. Without this, the inline
  // arrow `onClose` from the parent re-attaches the window listener
  // dozens of times per second.
  const filteredRef = useRef(filtered);
  const activeRef = useRef(active);
  const onCloseRef = useRef(onClose);
  useEffect(() => { filteredRef.current = filtered; }, [filtered]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Keyboard nav (mounted once per `open` toggle).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const len = filteredRef.current.length;
        setActive((i) => Math.min(i + 1, Math.max(len - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cur = filteredRef.current[activeRef.current];
        if (cur) cur.onRun();
      }
    };
    // Capture phase so Escape closes the palette before any inner
    // input handler swallows it.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open]);

  // Auto-scroll the active row into view.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLDivElement>(`[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  // Group filtered items in original order.
  const groupOrder: CmdItem["group"][] = ["Leads", "Actions", "Navigation", "Settings", "Recent"];
  const groups = groupOrder
    .map((g) => ({ name: g, list: filtered.filter((it) => it.group === g) }))
    .filter((g) => g.list.length);
  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600, maxWidth: "92vw",
          marginTop: "12vh",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-edge)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Input */}
        <div
          className="flex items-center gap-3"
          style={{ height: 52, padding: "0 14px", borderBottom: "1px solid var(--border-divider)" }}
        >
          <Search size={15} color="var(--text-secondary)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search commands, leads, actions..."
            className="flex-1 bg-transparent outline-none"
            style={{
              fontSize: 14, color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close palette"
          >
            <span className="ls-kbd">ESC</span>
            <X size={12} />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: 420, overflowY: "auto", padding: "6px 0" }}
        >
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 py-10 text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              <Search size={18} />
              <div>No results for "{query}"</div>
              <div style={{ color: "var(--text-ghost)" }}>Try a lead name or command</div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.name}>
                <div
                  className="ls-section-label"
                  style={{ padding: "8px 14px 4px", color: "var(--text-muted)" }}
                >
                  {group.name}
                </div>
                {group.list.map((it) => {
                  runningIdx += 1;
                  const idx = runningIdx;
                  const isActive = idx === active;
                  const Icon = it.icon;
                  return (
                    <div
                      key={it.id}
                      data-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={it.onRun}
                      className="flex items-center gap-3 cursor-pointer"
                      style={{
                        height: 36,
                        padding: "0 14px",
                        background: isActive ? "var(--amber-soft)" : "transparent",
                        borderLeft: `2px solid ${isActive ? "var(--amber)" : "transparent"}`,
                        paddingLeft: 12,
                      }}
                    >
                      <Icon
                        size={14}
                        color={isActive ? "var(--amber-text)" : "var(--text-secondary)"}
                      />
                      <span
                        className="flex-1 text-[12.5px]"
                        style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                      >
                        <Highlighted text={it.label} q={query} />
                        {it.meta && (
                          <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                            — {it.meta}
                          </span>
                        )}
                      </span>
                      {it.hint && (
                        <span
                          className="text-[10.5px] ls-num"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {it.hint}
                        </span>
                      )}
                      {it.shortcut && <span className="ls-kbd">{it.shortcut}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-3 text-[10.5px]"
          style={{
            height: 30,
            borderTop: "1px solid var(--border-divider)",
            color: "var(--text-muted)",
            background: "var(--bg-surface)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="ls-kbd">↑</span>
            <span className="ls-kbd">↓</span>
            <span>navigate</span>
            <span style={{ color: "var(--text-ghost)" }}>·</span>
            <span className="ls-kbd">↵</span>
            <span>open</span>
          </div>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}

function Highlighted({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "var(--amber-text)", fontWeight: 600 }}>
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}
