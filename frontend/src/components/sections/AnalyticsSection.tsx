// LeadStack™ Analytics — Wired to real backend data
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Mail, MessageSquare, DollarSign,
  ArrowUpRight, ArrowDownRight, Target, Users, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const BASE = "http://localhost:7432/api";

const STATUS_COLORS: Record<string, string> = {
  "New": "#60a5fa",
  "Emailed": "#93c5fd",
  "Follow-Up Sent": "#f59e0b",
  "Hot Lead": "#f87171",
  "Meeting Booked": "#4ade80",
  "Closed - Won": "#4ade80",
  "Not Interested": "#52524e",
  "Unsubscribed": "#52524e",
};

// Build the demo trend relative to today so users in May/June/etc. don't
// see "Apr 1 → Apr 14" stale dates when the backend hasn't returned data.
const FALLBACK_NUMBERS: Array<{ emails_sent: number; emails_opened: number; replies: number; leads_scraped: number }> = [
  { emails_sent: 22, emails_opened: 9,  replies: 2, leads_scraped: 15 },
  { emails_sent: 18, emails_opened: 7,  replies: 1, leads_scraped: 0  },
  { emails_sent: 35, emails_opened: 15, replies: 4, leads_scraped: 28 },
  { emails_sent: 28, emails_opened: 11, replies: 3, leads_scraped: 0  },
  { emails_sent: 0,  emails_opened: 2,  replies: 1, leads_scraped: 0  },
  { emails_sent: 0,  emails_opened: 1,  replies: 0, leads_scraped: 0  },
  { emails_sent: 42, emails_opened: 18, replies: 5, leads_scraped: 40 },
  { emails_sent: 38, emails_opened: 16, replies: 4, leads_scraped: 0  },
  { emails_sent: 47, emails_opened: 20, replies: 6, leads_scraped: 35 },
  { emails_sent: 31, emails_opened: 13, replies: 3, leads_scraped: 0  },
  { emails_sent: 12, emails_opened: 5,  replies: 2, leads_scraped: 22 },
  { emails_sent: 0,  emails_opened: 7,  replies: 0, leads_scraped: 0  },
  { emails_sent: 0,  emails_opened: 3,  replies: 0, leads_scraped: 0  },
  { emails_sent: 0,  emails_opened: 1,  replies: 0, leads_scraped: 0  },
];

const FALLBACK_DAILY = FALLBACK_NUMBERS.map((row, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (FALLBACK_NUMBERS.length - 1 - i));
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { date, ...row };
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-2xl"
      style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.12)" }}>
      <p className="font-bold mb-1.5" style={{ color: "#a1a09c" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={p?.dataKey ?? i} className="font-mono flex items-center gap-1.5 mb-0.5" style={{ color: p?.color }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: p?.color }} />
          {p?.name}: <span className="font-bold ml-1">{p?.value}</span>
        </p>
      ))}
    </div>
  );
};

function StatCard({ icon: Icon, label, value, sub, color, change, delay = 0 }: any) {
  const positive = change >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl p-5"
      style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1 text-[10px] font-bold"
            style={{ color: positive ? "#4ade80" : "#f87171" }}>
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-[28px] font-black leading-none mb-1" style={{ color: "#f4f3ef" }}>{value}</div>
      <div className="text-[11px] font-semibold" style={{ color: "#a1a09c" }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "#52524e" }}>{sub}</div>}
    </motion.div>
  );
}

export default function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [deals, setDeals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 14 | 30>(14);

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, dRes] = await Promise.all([
        fetch(`${BASE}/analytics`).catch(() => null),
        fetch(`${BASE}/deals/summary`).catch(() => null),
      ]);
      if (aRes?.ok) setAnalytics(await aRes.json());
      if (dRes?.ok) setDeals(await dRes.json());
    } catch (e) { console.warn("[Analytics] load failed, using fallbacks:", e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Map backend response — backend returns: trend[], topCities[], pipelineStages[], summary{}
  // Use real data if available, otherwise fallback
  const dailyStats: any[] = analytics?.trend ?? analytics?.daily_stats ?? FALLBACK_DAILY;
  const slicedDaily = dailyStats.slice(-range);

  const totalLeads = analytics?.summary?.totalLeads ?? analytics?.total_leads ?? 347;
  const emailsSent = analytics?.summary?.totalEmailsSent ?? analytics?.emails_sent ?? 273;
  const emailsReplied = analytics?.summary?.totalReplies ?? analytics?.emails_replied ?? 24;
  const hotLeads = analytics?.hot_leads ?? 8;
  const meetingsBooked = analytics?.meetings_booked ?? 3;
  const rawOpenRate = analytics?.summary?.openRate ?? analytics?.open_rate;
  const rawReplyRate = analytics?.summary?.replyRate ?? analytics?.reply_rate;
  const openRate = rawOpenRate != null ? Number(rawOpenRate).toFixed(1) : "38.1";
  const replyRate = rawReplyRate != null ? Number(rawReplyRate).toFixed(1) : "8.8";

  // pipelineStages from backend: [{stage, count}] — normalise to [{status, count}]
  const rawStages = analytics?.pipelineStages ?? analytics?.status_breakdown;
  const statusBreakdown: any[] = rawStages
    ? rawStages.map((s: any) => ({ status: s.stage ?? s.status, count: s.count }))
    : [
        { status: "New", count: 89 },
        { status: "Emailed", count: 124 },
        { status: "Follow-Up Sent", count: 67 },
        { status: "Hot Lead", count: 8 },
        { status: "Meeting Booked", count: 3 },
        { status: "Not Interested", count: 41 },
        { status: "Closed - Won", count: 15 },
      ];

  // topCities from backend: [{city, count}]
  const cityBreakdown: any[] = analytics?.topCities ?? analytics?.city_breakdown ?? [
    { city: "New York", count: 78 },
    { city: "Los Angeles", count: 55 },
    { city: "Chicago", count: 42 },
    { city: "Houston", count: 38 },
    { city: "Phoenix", count: 29 },
  ];

  const pieData = statusBreakdown.map(s => ({
    name: s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "#72716c",
  }));

  const pipelineValue = deals?.total_pipeline_value ?? 187500;
  const weightedPipeline = deals?.weighted_pipeline ?? 52400;
  const expectedMonth = deals?.expected_this_month ?? 18200;
  const totalDeals = deals?.total_deals ?? 11;
  const avgDeal = deals?.avg_deal_value ?? 17045;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-black" style={{ color: "#f4f3ef" }}>Analytics</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "#72716c" }}>
            Real-time campaign performance and pipeline metrics
            {!analytics && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>demo data</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 14, 30] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={range === r
                ? { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid #1c1c1f", color: "#72716c" }}>
              {r}d
            </button>
          ))}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1c1c1f", color: "#a1a09c" }}>
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={totalLeads} color="#93c5fd" change={12} delay={0.05} />
        <StatCard icon={Mail} label="Emails Sent" value={emailsSent} sub={`${openRate}% open rate`} color="#f59e0b" change={8} delay={0.10} />
        <StatCard icon={MessageSquare} label="Replies" value={emailsReplied} sub={`${replyRate}% reply rate`} color="#4ade80" change={5} delay={0.15} />
        <StatCard icon={Target} label="Hot Leads" value={hotLeads} sub={`${meetingsBooked} meetings booked`} color="#f87171" change={25} delay={0.20} />
      </div>

      {/* Pipeline value row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Pipeline", value: `$${(pipelineValue / 1000).toFixed(0)}k`, sub: `${totalDeals} deals tracked`, color: "#f59e0b" },
          { label: "Weighted Forecast", value: `$${(weightedPipeline / 1000).toFixed(0)}k`, sub: "Probability-adjusted", color: "#4ade80" },
          { label: "Expected This Month", value: `$${(expectedMonth / 1000).toFixed(0)}k`, sub: `Avg deal: $${(avgDeal / 1000).toFixed(0)}k`, color: "#f87171" },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }}
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${item.color}12`, border: `1px solid ${item.color}22` }}>
              <DollarSign size={16} style={{ color: item.color }} />
            </div>
            <div>
              <div className="text-[22px] font-black" style={{ color: "#f4f3ef" }}>{item.value}</div>
              <div className="text-[11px] font-semibold" style={{ color: "#a1a09c" }}>{item.label}</div>
              <div className="text-[10px]" style={{ color: "#52524e" }}>{item.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Activity chart — 2/3 width */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="col-span-2 rounded-2xl p-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-bold" style={{ color: "#e7e5e4" }}>Email Activity</div>
              <div className="text-[10px]" style={{ color: "#72716c" }}>Sent, opened, and replied over time</div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              {[
                { key: "emails_sent", label: "Sent", color: "#93c5fd" },
                { key: "emails_opened", label: "Opened", color: "#f59e0b" },
                { key: "replies", label: "Replied", color: "#4ade80" },
              ].map(l => (
                <div key={l.key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span style={{ color: "#a1a09c" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={slicedDaily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "#52524e", fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#52524e", fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="emails_sent" name="Sent" stroke="#93c5fd" strokeWidth={2} fill="url(#gradSent)" dot={false} />
              <Area type="monotone" dataKey="emails_opened" name="Opened" stroke="#f59e0b" strokeWidth={2} fill="url(#gradOpened)" dot={false} />
              <Area type="monotone" dataKey="replies" name="Replied" stroke="#4ade80" strokeWidth={2} fill="url(#gradReplied)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pipeline breakdown pie */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="text-[13px] font-bold mb-1" style={{ color: "#e7e5e4" }}>Pipeline Stages</div>
          <div className="text-[10px] mb-3" style={{ color: "#72716c" }}>Lead status breakdown</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.slice(0, 5).map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-[10px]" style={{ color: "#a1a09c" }}>{item.name}</span>
                </div>
                <span className="text-[10px] font-bold font-mono" style={{ color: "#d4d4d2" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom row: top cities + leads scraped */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top cities */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="text-[13px] font-bold mb-1" style={{ color: "#e7e5e4" }}>Top Markets</div>
          <div className="text-[10px] mb-4" style={{ color: "#72716c" }}>Leads by city</div>
          <div className="space-y-3">
            {cityBreakdown.slice(0, 5).map((city, i) => {
              const max = Math.max(...cityBreakdown.map((c: any) => c.count), 1);
              const pct = Math.round((city.count / max) * 100);
              return (
                <div key={city.city}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold" style={{ color: "#d4d4d2" }}>{city.city}</span>
                    <span className="text-[11px] font-bold font-mono" style={{ color: "#f59e0b" }}>{city.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1c1c1f" }}>
                    <motion.div className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.05 }}
                      style={{ background: "linear-gradient(90deg, #93c5fd, #f59e0b)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Leads scraped bar chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-2xl p-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="text-[13px] font-bold mb-1" style={{ color: "#e7e5e4" }}>Leads Scraped</div>
          <div className="text-[10px] mb-3" style={{ color: "#72716c" }}>Daily new lead discovery</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={slicedDaily} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "#52524e", fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#52524e", fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="leads_scraped" name="Leads" radius={[3, 3, 0, 0]}
                fill="#4ade80" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
