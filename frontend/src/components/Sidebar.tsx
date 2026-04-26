// LeadStack — Sidebar (Precision Dark)
// Block 1: 188px fixed, MAIN/TOOLS/INTEL/ACCOUNT groups, amber accents.
import {
  LayoutDashboard, Users, GitBranch, Mail, Search, Zap, Linkedin,
  MessageSquare, TrendingUp, Flame, Shield, Settings, MoreHorizontal,
  Compass,
} from "lucide-react";

export type SectionId =
  | "dashboard" | "scraper" | "linkedin" | "email" | "followup"
  | "replies" | "analytics" | "crm" | "warmup" | "deliverability"
  | "prospector" | "settings";

interface SidebarProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
  replyCount?: number;
  hotLeadCount?: number;
}

type NavItem = {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  badge?: "hot" | "count";
};

type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "crm",       label: "Leads",     icon: Users, badge: "hot" },
      { id: "analytics", label: "Pipeline",  icon: TrendingUp },
      { id: "email",     label: "Campaigns", icon: Mail, badge: "count" },
      { id: "replies",   label: "Inbox",     icon: MessageSquare, badge: "count" },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "prospector",     label: "Prospector",  icon: Compass },
      { id: "scraper",        label: "Scraper",     icon: Search },
      { id: "linkedin",       label: "LinkedIn",    icon: Linkedin },
      { id: "followup",       label: "Sequences",   icon: GitBranch },
      { id: "warmup",         label: "Warmup",      icon: Flame },
      { id: "deliverability", label: "Deliverability", icon: Shield },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar({ active, onChange, replyCount = 0, hotLeadCount = 0 }: SidebarProps) {
  const renderBadge = (item: NavItem): React.ReactNode => {
    if (item.badge === "hot" && hotLeadCount > 0) {
      return (
        <span
          className="ml-auto text-[10px] font-semibold ls-num"
          style={{
            background: "rgba(248,113,113,0.15)",
            color: "#fca5a5",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 999, padding: "1px 6px", lineHeight: 1.2,
          }}
        >
          {hotLeadCount}
        </span>
      );
    }
    if (item.id === "replies" && replyCount > 0) {
      return (
        <span
          className="ml-auto text-[10px] font-semibold ls-num"
          style={{
            background: "rgba(248,113,113,0.15)",
            color: "#fca5a5",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 999, padding: "1px 6px", lineHeight: 1.2,
          }}
        >
          {replyCount}
        </span>
      );
    }
    if (item.id === "email") {
      return (
        <span
          className="ml-auto text-[10px] font-medium ls-num"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "#a1a09c",
            border: "1px solid #222226",
            borderRadius: 999, padding: "1px 6px", lineHeight: 1.2,
          }}
        >
          3
        </span>
      );
    }
    return null;
  };

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 select-none"
      style={{
        width: 200,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-divider)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-3"
        style={{
          height: 48,
          borderBottom: "1px solid var(--border-divider)",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: "var(--amber)",
            boxShadow: "0 0 0 1px rgba(245,158,11,0.4)",
          }}
        >
          <Zap size={14} color="#09090b" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
            LeadStack
          </div>
          <div
            className="text-[9px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Outreach OS
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4"
        style={{ scrollbarGutter: "stable" }}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="ls-section-label mb-1.5">{group.label}</div>
            <div className="space-y-px">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChange(item.id)}
                    className={`ls-nav w-full ${isActive ? "active" : ""}`}
                  >
                    <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {renderBadge(item)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div
        className="px-2 py-2.5"
        style={{ borderTop: "1px solid var(--border-divider)" }}
      >
        <div
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span
            className="ls-avatar"
            style={{
              width: 26, height: 26,
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              fontSize: 10.5,
            }}
          >
            JD
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[11.5px] font-medium truncate leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Jake Dawson
            </div>
            <div
              className="text-[9.5px] uppercase tracking-wider"
              style={{ color: "var(--amber-text)" }}
            >
              Pro
            </div>
          </div>
          <button
            onClick={() => onChange("settings")}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Account options"
          >
            <MoreHorizontal size={14} color="#a1a09c" />
          </button>
        </div>
      </div>
    </aside>
  );
}
