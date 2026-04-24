// LeadStack™ Sidebar v3 — Premium redesign
// Design: Deep navy, gold accents, smooth collapse, grouped nav with icons
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Search, Mail, GitBranch, MessageSquare,
  Settings, ChevronLeft, ChevronRight,
  Zap, TrendingUp, Users, Sparkles, Flame, Shield, DollarSign, Linkedin
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type SectionId = "dashboard" | "scraper" | "linkedin" | "email" | "followup" | "replies" | "analytics" | "crm" | "warmup" | "deliverability" | "settings";

interface SidebarProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
  replyCount?: number;
}

const NAV_GROUPS = [
  {
    label: "OUTREACH",
    items: [
      { id: "dashboard" as SectionId, label: "Dashboard", icon: LayoutDashboard },
      { id: "scraper" as SectionId, label: "Lead Scraper", icon: Search },
      { id: "linkedin" as SectionId, label: "LinkedIn Scraper", icon: Linkedin },
      { id: "email" as SectionId, label: "Email Engine", icon: Mail },
      { id: "followup" as SectionId, label: "Sequences", icon: GitBranch },
      { id: "replies" as SectionId, label: "Reply Monitor", icon: MessageSquare, isReplies: true },
    ]
  },
  {
    label: "INTELLIGENCE",
    items: [
      { id: "crm" as SectionId, label: "Pipeline CRM", icon: Users },
      { id: "analytics" as SectionId, label: "Analytics", icon: TrendingUp },
    ]
  },
  {
    label: "DELIVERABILITY",
    items: [
      { id: "warmup" as SectionId, label: "Email Warmup", icon: Flame },
      { id: "deliverability" as SectionId, label: "Spam Checker", icon: Shield },
    ]
  },
  {
    label: "SYSTEM",
    items: [
      { id: "settings" as SectionId, label: "Settings", icon: Settings },
    ]
  }
];

export default function Sidebar({ active, onChange, replyCount = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-screen relative z-20 overflow-hidden select-none"
      style={{
        background: "oklch(0.085 0.022 255)",
        borderRight: "1px solid oklch(1 0 0 / 0.07)",
        flexShrink: 0,
      }}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 overflow-hidden"
        style={{ height: 60, padding: "0 16px", borderBottom: "1px solid oklch(1 0 0 / 0.07)", flexShrink: 0 }}>
        {/* Logo mark */}
        <div className="flex-shrink-0 relative">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.12 75 / 0.30), oklch(0.72 0.12 75 / 0.10))",
              border: "1px solid oklch(0.72 0.12 75 / 0.40)",
              boxShadow: "0 0 16px oklch(0.72 0.12 75 / 0.20)",
            }}>
            <Zap size={14} style={{ color: "oklch(0.88 0.14 75)" }} />
          </div>
          {/* Live dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
            style={{ background: "oklch(0.65 0.18 145)", borderColor: "oklch(0.085 0.022 255)" }} />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }} className="overflow-hidden whitespace-nowrap">
              <div className="text-[14px] font-bold tracking-tight leading-none" style={{ color: "oklch(0.95 0.008 65)" }}>
                Lead<span style={{ color: "oklch(0.82 0.14 75)" }}>Stack</span>
                <span className="text-[10px] ml-0.5 align-top" style={{ color: "oklch(0.72 0.12 75 / 0.7)" }}>™</span>
              </div>
              <div className="text-[9px] font-semibold tracking-[0.18em] uppercase mt-0.5" style={{ color: "oklch(0.38 0.015 255)" }}>Outreach OS</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status pill */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="mx-3 mt-3 mb-1 px-3 py-2 rounded-xl flex items-center gap-2.5"
            style={{ background: "oklch(0.65 0.18 145 / 0.07)", border: "1px solid oklch(0.65 0.18 145 / 0.15)" }}>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.65 0.18 145)" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "oklch(0.72 0.16 145)" }} />
            </span>
            <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.16 145)" }}>Machine Active</span>
            <Sparkles size={10} className="ml-auto" style={{ color: "oklch(0.65 0.18 145 / 0.5)" }} />
          </motion.div>
        )}
      </AnimatePresence>
      {collapsed && <div className="h-3" />}

      {/* Grouped Nav */}
      <nav className="flex-1 px-2.5 py-1 overflow-y-auto overflow-x-hidden space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
                  className="px-2.5 pb-1.5 text-[9px] font-bold tracking-[0.20em]" style={{ color: "oklch(0.38 0.015 255)" }}>
                  {group.label}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                const badge = (item as any).isReplies && replyCount > 0 ? replyCount : null;
                return (
                  <button key={item.id} onClick={() => onChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl text-[12.5px] font-medium transition-all duration-150",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                      isActive
                        ? "text-[oklch(0.92_0.008_65)]"
                        : "text-[oklch(0.45_0.015_255)] hover:text-[oklch(0.75_0.008_65)] hover:bg-white/[0.03]"
                    )}
                    style={isActive ? {
                      background: "oklch(0.72 0.12 75 / 0.12)",
                      boxShadow: "inset 0 0 0 1px oklch(0.72 0.12 75 / 0.18)",
                    } : {}}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={15} className="flex-shrink-0"
                      style={isActive ? { color: "oklch(0.82 0.14 75)" } : {}} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.12 }} className="whitespace-nowrap flex-1 text-left">
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && badge && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                        style={{ background: "oklch(0.65 0.22 25 / 0.22)", color: "oklch(0.80 0.20 25)", border: "1px solid oklch(0.65 0.22 25 / 0.35)" }}>
                        {badge}
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile bottom */}
      <div className="px-2.5 py-3 space-y-1" style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)" }}>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: "oklch(1 0 0 / 0.03)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: "oklch(0.72 0.12 75 / 0.20)", color: "oklch(0.82 0.14 75)" }}>
                U
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate" style={{ color: "oklch(0.78 0.008 65)" }}>User</div>
                <div className="text-[9px] truncate" style={{ color: "oklch(0.40 0.015 255)" }}>Pro Plan</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => onChange("settings")}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl text-[12px] font-medium transition-all duration-150 hover:bg-white/[0.03]",
            collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
          )}
          style={{ color: "oklch(0.38 0.015 255)" }}
          title={collapsed ? "Settings" : undefined}>
          <Settings size={14} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] w-6 h-6 rounded-full flex items-center justify-center z-30 transition-all hover:scale-110"
        style={{
          background: "oklch(0.18 0.028 255)",
          border: "1px solid oklch(1 0 0 / 0.14)",
          color: "oklch(0.48 0.015 255)",
          boxShadow: "0 2px 8px oklch(0 0 0 / 0.3)",
        }}>
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </motion.aside>
  );
}
