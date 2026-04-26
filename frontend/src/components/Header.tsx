// LeadStack — Header (Precision Dark)
// Block 1: 48px topbar with title + breadcrumb, search trigger, sync dot, bell, avatar.
import { Bell, Search, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  section: string;
  notifications?: number;
  backendOnline?: boolean;
  onNavigate?: (section: string) => void;
  onBriefing?: () => void;
  onCommandPalette?: () => void;
}

const SECTION_META: Record<string, { label: string; description: string }> = {
  dashboard:      { label: "Dashboard",     description: "Overview" },
  scraper:        { label: "Scraper",       description: "Lead discovery" },
  linkedin:       { label: "LinkedIn",      description: "Decision-makers" },
  email:          { label: "Campaigns",     description: "Email engine" },
  followup:       { label: "Sequences",     description: "Outreach automation" },
  replies:        { label: "Inbox",         description: "Reply monitor" },
  crm:            { label: "Leads",         description: "Pipeline" },
  analytics:      { label: "Pipeline",      description: "Performance" },
  warmup:         { label: "Warmup",        description: "Sender reputation" },
  deliverability: { label: "Deliverability", description: "Spam checker" },
  prospector:     { label: "Prospector",    description: "B2B search" },
  settings:       { label: "Settings",      description: "Workspace config" },
};

export default function Header({
  section,
  notifications = 0,
  backendOnline = true,
  onCommandPalette,
}: HeaderProps) {
  const [syncedAgo, setSyncedAgo] = useState("just now");
  const meta = SECTION_META[section] ?? { label: section, description: "" };

  useEffect(() => {
    let mins = 0;
    const id = setInterval(() => {
      mins += 1;
      setSyncedAgo(mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="flex items-center px-4 flex-shrink-0"
      style={{
        height: 48,
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border-divider)",
      }}
    >
      {/* Title + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <span className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
          {meta.label}
        </span>
        <ChevronRight size={12} color="var(--text-muted)" />
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          LeadStack
        </span>
        <ChevronRight size={12} color="var(--text-muted)" />
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {meta.label}
        </span>
      </div>

      {/* Search trigger */}
      <button
        onClick={onCommandPalette}
        className="flex items-center gap-2 mx-auto"
        style={{
          width: 320, maxWidth: "40%",
          height: 30,
          padding: "0 10px",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-edge)",
          borderRadius: 6,
          color: "var(--text-muted)",
          fontSize: 12,
          textAlign: "left",
        }}
      >
        <Search size={12} />
        <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
          Search leads, companies, domains...
        </span>
        <span className="ls-kbd">⌘K</span>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Sync status */}
        <div className="flex items-center gap-1.5">
          <span
            className="ls-dot"
            style={{ background: backendOnline ? "var(--success)" : "var(--danger)" }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {backendOnline ? "Synced" : "Offline"}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            · {syncedAgo}
          </span>
        </div>

        <span style={{ width: 1, height: 18, background: "var(--border-divider)" }} />

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center"
          style={{
            width: 30, height: 30, borderRadius: 6,
            background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-secondary)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          aria-label="Notifications"
        >
          <Bell size={14} />
          {notifications > 0 && (
            <span
              style={{
                position: "absolute", top: 6, right: 6,
                width: 6, height: 6, borderRadius: 999,
                background: "var(--danger)",
                boxShadow: "0 0 0 2px var(--bg-base)",
              }}
            />
          )}
        </button>

        {/* User avatar */}
        <span
          className="ls-avatar"
          style={{ width: 26, height: 26, fontSize: 10.5 }}
        >
          JD
        </span>
      </div>
    </header>
  );
}
