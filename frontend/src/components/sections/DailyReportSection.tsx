// LeadStack™ — Daily Report Section
// Generates and displays daily performance reports
import { motion } from "framer-motion";
import { useState } from "react";
import { FileText, RefreshCw, TrendingUp, Mail, Users, MessageSquare, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getDailyReport, generateReport, type DailyReport } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { toast } from "sonner";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.12)" }}>
      <p className="font-medium mb-1" style={{ color: "#a1a09c" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const FALLBACK_REPORT: DailyReport = {
  date: new Date().toISOString().split("T")[0],
  newLeads: 0, emailsSent: 0, emailsOpened: 0, repliesReceived: 0,
  hotLeads: 0, openRate: 0, replyRate: 0,
  weeklyData: [], topCities: [],
  summary: "No report generated yet. Click 'Generate Report' to create today's report.",
};

export default function DailyReportSection() {
  const [generating, setGenerating] = useState(false);

  const { data: report, loading, error, refetch } = useApi(getDailyReport, [], {
    fallback: FALLBACK_REPORT
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReport();
      toast.success("Daily report generated!");
      refetch();
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "Backend offline?"}`);
    } finally {
      setGenerating(false);
    }
  };

  const r = report ?? FALLBACK_REPORT;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#f4f3ef" }}>Daily Report</h1>
          <p className="text-xs mt-0.5" style={{ color: "#72716c" }}>
            {r.date} · Auto-generated at 8:00 AM
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
              <AlertCircle size={12} />
              Backend offline
            </div>
          )}
          <button onClick={refetch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "#121214", color: "#a1a09c", border: "1px solid rgba(244,243,239,0.1)" }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: "#f59e0b", color: "#09090b" }}>
            {generating ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
            Generate Report
          </button>
        </div>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "New Leads", value: r.newLeads, icon: Users, color: "#f59e0b" },
          { label: "Emails Sent", value: r.emailsSent, icon: Mail, color: "#a5b4fc" },
          { label: "Replies", value: r.repliesReceived, icon: MessageSquare, color: "#4ade80" },
          { label: "Hot Leads", value: r.hotLeads, icon: TrendingUp, color: "#a1a09c" },
        ].map((stat, i) => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-lg p-4"
            style={{ background: "#121214", border: "1px solid #1c1c1f", borderTop: `2px solid ${stat.color}` }}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={13} style={{ color: stat.color }} />
              <span className="text-[10px]" style={{ color: "#a1a09c" }}>{stat.label}</span>
            </div>
            <div className="font-mono text-2xl font-bold" style={{ color: "#f4f3ef" }}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Open Rate", value: r.openRate, suffix: "%", color: "#f59e0b", note: "Industry avg: 21%" },
          { label: "Reply Rate", value: r.replyRate, suffix: "%", color: "#4ade80", note: "Industry avg: 3%" },
        ].map(stat => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg p-4"
            style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "#a1a09c" }}>{stat.label}</span>
              <span className="text-[10px]" style={{ color: "#72716c" }}>{stat.note}</span>
            </div>
            <div className="font-mono text-3xl font-bold mb-2" style={{ color: stat.color }}>
              {stat.value.toFixed(1)}{stat.suffix}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1c1c1f" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(stat.value, 100)}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full" style={{ background: stat.color }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      {r.weeklyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-lg p-4"
            style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "#f4f3ef" }}>7-Day Leads & Emails</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={r.weeklyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#72716c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#72716c" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="leads" name="Leads" fill="rgba(245,158,11,0.8)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="emails" name="Emails" fill="rgba(165,180,252,0.8)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-lg p-4"
            style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "#f4f3ef" }}>7-Day Replies</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={r.weeklyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#72716c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#72716c" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="replies" name="Replies" stroke="#4ade80" strokeWidth={2} dot={{ fill: "#4ade80", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Summary */}
      {r.summary && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-lg p-4"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#f4f3ef" }}>AI Summary</h3>
          <p className="text-sm leading-relaxed" style={{ color: "#a1a09c" }}>{r.summary}</p>
        </motion.div>
      )}
    </div>
  );
}
