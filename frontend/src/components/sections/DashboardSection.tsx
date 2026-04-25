// LeadStack™ Dashboard v3 — Premium redesign
// Design: Asymmetric grid, large stat numbers, gradient accents, sparklines, hot leads feed
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar
} from "recharts";
import {
  Users, Mail, TrendingUp, MessageSquare,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Clock, CheckCircle2, Zap, Target, Flame,
  ChevronRight, Activity
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getStats, getDailyReport } from "@/lib/api";

function useCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target) || target === 0) { setValue(target || 0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

const WEEKLY_DATA = [
  { day: "Mon", leads: 24, emails: 18, replies: 3 },
  { day: "Tue", leads: 31, emails: 25, replies: 5 },
  { day: "Wed", leads: 19, emails: 16, replies: 2 },
  { day: "Thu", leads: 42, emails: 38, replies: 8 },
  { day: "Fri", leads: 38, emails: 30, replies: 6 },
  { day: "Sat", leads: 12, emails: 8, replies: 1 },
  { day: "Sun", leads: 7, emails: 4, replies: 0 },
];

const SPARKLINE_DATA = [4, 7, 3, 9, 6, 12, 8, 15, 11, 18, 14, 22];

const HOT_LEADS = [
  { name: "James Whitfield", company: "Whitfield Capital", score: 94, status: "Meeting Booked", time: "2h ago" },
  { name: "Sarah Chen", company: "Chen Financial Group", score: 87, status: "Replied", time: "4h ago" },
  { name: "Marcus Rivera", company: "Rivera Wealth", score: 81, status: "Interested", time: "6h ago" },
  { name: "Lisa Monroe", company: "Monroe Wealth", score: 99, status: "Closed", time: "1d ago" },
];

const ACTIVITY = [
  { icon: CheckCircle2, color: "oklch(0.65 0.18 145)", text: "Reply from Sarah Chen — Interested in demo", time: "2m ago", type: "reply" },
  { icon: Mail, color: "oklch(0.72 0.12 75)", text: "Sent 12 emails to NYC financial advisors", time: "18m ago", type: "email" },
  { icon: Users, color: "oklch(0.55 0.10 230)", text: "Scraped 47 new leads — independent advisors", time: "1h ago", type: "scrape" },
  { icon: MessageSquare, color: "oklch(0.65 0.22 25)", text: "Follow-up sequence triggered for 8 leads", time: "2h ago", type: "sequence" },
  { icon: Target, color: "oklch(0.72 0.12 75)", text: "Campaign 'Q2 Advisors' reached 200 contacts", time: "3h ago", type: "campaign" },
  { icon: CheckCircle2, color: "oklch(0.65 0.18 145)", text: "Meeting booked with James Whitfield", time: "5h ago", type: "reply" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-xs"
      style={{ background: "oklch(0.18 0.028 255)", border: "1px solid oklch(1 0 0 / 0.14)", boxShadow: "0 8px 32px oklch(0 0 0 / 0.4)", color: "oklch(0.80 0.008 65)" }}>
      <div className="font-semibold mb-1.5 text-[11px]" style={{ color: "oklch(0.92 0.008 65)" }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={p?.name ?? i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p?.color }} />
          <span style={{ color: "oklch(0.55 0.015 255)" }}>{p?.name}</span>
          <span className="font-mono font-bold ml-auto pl-3">{p?.value}</span>
        </div>
      ))}
    </div>
  );
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const w = 60, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.08" />
    </svg>
  );
}

function BigStatCard({ label, value, sub, icon: Icon, color, prefix = "", suffix = "", delay = 0, trend, sparkline = false }:
  { label: string; value: number; sub?: string; icon: React.ElementType; color: string;
    prefix?: string; suffix?: string; delay?: number; trend?: { value: number; positive: boolean }; sparkline?: boolean }) {
  const count = useCounter(value, 1200 + delay);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: "oklch(0.13 0.024 255)",
        border: "1px solid oklch(1 0 0 / 0.08)",
        boxShadow: `0 0 0 1px oklch(1 0 0 / 0.04), 0 4px 24px oklch(0 0 0 / 0.2)`,
      }}
    >
      {/* Glow blob */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: color, opacity: 0.06, filter: "blur(24px)" }} />
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{
              background: trend.positive ? "oklch(0.65 0.18 145 / 0.10)" : "oklch(0.65 0.22 25 / 0.10)",
              color: trend.positive ? "oklch(0.72 0.16 145)" : "oklch(0.72 0.20 25)",
            }}>
            {trend.positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[32px] font-bold leading-none tracking-tight mb-1.5 font-mono"
            style={{ color: "oklch(0.96 0.008 65)" }}>
            {prefix}{count.toLocaleString()}{suffix}
          </div>
          <div className="text-[12px] font-medium" style={{ color: "oklch(0.55 0.015 255)" }}>{label}</div>
          {sub && <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.40 0.015 255)" }}>{sub}</div>}
        </div>
        {sparkline && (
          <div className="opacity-70">
            <Sparkline data={SPARKLINE_DATA} color={color} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function DashboardSection() {
  const { data: stats, loading, refetch } = useApi(getStats);
  const { data: report } = useApi(getDailyReport);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    if (stats || report) setBackendOnline(true);
  }, [stats, report]);

  const totalLeads = stats?.totalLeads ?? 173;
  const emailsSent = stats?.emailsSent ?? 89;
  const openRate = stats?.openRate ?? 34;
  const replyRate = stats?.replyRate ?? 8;
  const hotLeads = stats?.hotLeads ?? 4;
  const meetings = stats?.meetingsBooked ?? 2;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-[1400px]">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: "oklch(0.96 0.008 65)" }}>
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "oklch(0.50 0.015 255)" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Your pipeline is running
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{
                background: backendOnline ? "oklch(0.65 0.18 145 / 0.10)" : "oklch(0.65 0.22 25 / 0.10)",
                border: `1px solid ${backendOnline ? "oklch(0.65 0.18 145 / 0.25)" : "oklch(0.65 0.22 25 / 0.25)"}`,
                color: backendOnline ? "oklch(0.72 0.16 145)" : "oklch(0.72 0.20 25)",
              }}>
              <span className="relative flex h-1.5 w-1.5">
                {backendOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.65 0.18 145)" }} />}
                <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ background: backendOnline ? "oklch(0.65 0.18 145)" : "oklch(0.65 0.22 25)" }} />
              </span>
              {backendOnline ? "Backend Live" : "Backend Offline"}
            </div>
            <button onClick={refetch} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:opacity-80"
              style={{ background: "oklch(0.16 0.024 255)", border: "1px solid oklch(1 0 0 / 0.10)", color: "oklch(0.60 0.015 255)" }}>
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Primary stat cards — 2 large + 4 smaller */}
        <div className="grid grid-cols-12 gap-4">
          {/* Large hero stats */}
          <div className="col-span-3">
            <BigStatCard label="Total Leads" value={totalLeads} icon={Users} color="oklch(0.55 0.10 230)"
              trend={{ value: 12, positive: true }} sub="All time" sparkline />
          </div>
          <div className="col-span-3">
            <BigStatCard label="Emails Sent" value={emailsSent} icon={Mail} color="oklch(0.72 0.12 75)"
              trend={{ value: 8, positive: true }} sub="This week" sparkline delay={80} />
          </div>
          {/* Smaller stats 2×2 */}
          <div className="col-span-3 grid grid-rows-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
              className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
              style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
              <div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: "oklch(0.96 0.008 65)" }}>{openRate}<span className="text-[14px] ml-0.5" style={{ color: "oklch(0.55 0.015 255)" }}>%</span></div>
                <div className="text-[11px] mt-1" style={{ color: "oklch(0.50 0.015 255)" }}>Open Rate</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.18 145 / 0.12)" }}>
                <TrendingUp size={15} style={{ color: "oklch(0.65 0.18 145)" }} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}
              className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
              style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
              <div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: "oklch(0.96 0.008 65)" }}>{replyRate}<span className="text-[14px] ml-0.5" style={{ color: "oklch(0.55 0.015 255)" }}>%</span></div>
                <div className="text-[11px] mt-1" style={{ color: "oklch(0.50 0.015 255)" }}>Reply Rate</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 0.12)" }}>
                <MessageSquare size={15} style={{ color: "oklch(0.65 0.22 25)" }} />
              </div>
            </motion.div>
          </div>
          <div className="col-span-3 grid grid-rows-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
              className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
              style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
              <div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: "oklch(0.96 0.008 65)" }}>{hotLeads}</div>
                <div className="text-[11px] mt-1" style={{ color: "oklch(0.50 0.015 255)" }}>Hot Leads</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 0.12)" }}>
                <Flame size={15} style={{ color: "oklch(0.72 0.20 25)" }} />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
              className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
              style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
              <div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: "oklch(0.96 0.008 65)" }}>{meetings}</div>
                <div className="text-[11px] mt-1" style={{ color: "oklch(0.50 0.015 255)" }}>Meetings Booked</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.18 145 / 0.12)" }}>
                <CheckCircle2 size={15} style={{ color: "oklch(0.65 0.18 145)" }} />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-12 gap-4">

          {/* Weekly activity chart — 8 cols */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="col-span-8 rounded-2xl p-5"
            style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[14px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Weekly Activity</div>
                <div className="text-[11px] mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>Leads scraped, emails sent, and replies received</div>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                {[
                  { color: "oklch(0.55 0.10 230)", label: "Leads" },
                  { color: "oklch(0.72 0.12 75)", label: "Emails" },
                  { color: "oklch(0.65 0.18 145)", label: "Replies" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                    <span style={{ color: "oklch(0.50 0.015 255)" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={WEEKLY_DATA} barGap={3} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 0.03)", radius: 4 }} />
                <Bar dataKey="leads" fill="oklch(0.55 0.10 230)" radius={[4, 4, 0, 0]} name="Leads" />
                <Bar dataKey="emails" fill="oklch(0.72 0.12 75)" radius={[4, 4, 0, 0]} name="Emails" />
                <Bar dataKey="replies" fill="oklch(0.65 0.18 145)" radius={[4, 4, 0, 0]} name="Replies" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Hot leads panel — 4 cols */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="col-span-4 rounded-2xl p-5 flex flex-col"
            style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame size={14} style={{ color: "oklch(0.72 0.20 25)" }} />
                <span className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Hot Leads</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "oklch(0.65 0.22 25 / 0.12)", color: "oklch(0.72 0.20 25)", border: "1px solid oklch(0.65 0.22 25 / 0.25)" }}>
                {HOT_LEADS.length} active
              </span>
            </div>
            <div className="space-y-2.5 flex-1">
              {HOT_LEADS.map((lead, i) => (
                <motion.div key={lead.name} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover:border-white/10"
                  style={{ background: "oklch(0.16 0.024 255)", border: "1px solid oklch(1 0 0 / 0.06)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.82 0.14 75)" }}>
                    {lead.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: "oklch(0.88 0.008 65)" }}>{lead.name}</div>
                    <div className="text-[10px] truncate" style={{ color: "oklch(0.48 0.015 255)" }}>{lead.company}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] font-bold font-mono" style={{ color: "oklch(0.65 0.18 145)" }}>{lead.score}</div>
                    <div className="text-[9px]" style={{ color: "oklch(0.42 0.015 255)" }}>{lead.time}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <button className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all hover:opacity-80"
              style={{ background: "oklch(0.16 0.024 255)", color: "oklch(0.55 0.015 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
              View Pipeline <ChevronRight size={11} />
            </button>
          </motion.div>
        </div>

        {/* Bottom row: Activity + Quick actions */}
        <div className="grid grid-cols-12 gap-4">

          {/* Recent Activity */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="col-span-7 rounded-2xl p-5"
            style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={13} style={{ color: "oklch(0.55 0.10 230)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Recent Activity</span>
            </div>
            <div className="space-y-1">
              {ACTIVITY.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.04 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:border-white/8"
                    style={{ border: "1px solid transparent" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${item.color}15` }}>
                      <Icon size={11} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px]" style={{ color: "oklch(0.72 0.008 65)" }}>{item.text}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: "oklch(0.40 0.015 255)" }}>
                      <Clock size={9} />
                      {item.time}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="col-span-5 rounded-2xl p-5 flex flex-col"
            style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={13} style={{ color: "oklch(0.72 0.12 75)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Quick Actions</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 flex-1">
              {[
                { label: "Start Scraping", sub: "Find new leads", icon: Users, color: "oklch(0.55 0.10 230)" },
                { label: "Send Emails", sub: "Launch campaign", icon: Mail, color: "oklch(0.72 0.12 75)" },
                { label: "Check Replies", sub: "2 unread", icon: MessageSquare, color: "oklch(0.65 0.22 25)" },
                { label: "View Pipeline", sub: "CRM board", icon: Target, color: "oklch(0.65 0.18 145)" },
              ].map((action, i) => {
                const Icon = action.icon;
                return (
                  <motion.button key={i}
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-start gap-2 p-3.5 rounded-xl text-left transition-all"
                    style={{ background: `${action.color}0D`, border: `1px solid ${action.color}20` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${action.color}18` }}>
                      <Icon size={14} style={{ color: action.color }} />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: "oklch(0.85 0.008 65)" }}>{action.label}</div>
                      <div className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>{action.sub}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
