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
      style={{ background: "oklch(0.16 0.025 255)", border: "1px solid oklch(1 0 0 / 0.12)" }}>
      <p className="font-medium mb-1" style={{ color: "oklch(0.75 0.008 65)" }}>{label}</p>
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
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>Daily Report</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>
            {r.date} · Auto-generated at 8:00 AM
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
          <button onClick={refetch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "oklch(0.13 0.025 255)", color: "oklch(0.75 0.008 65)", border: "1px solid oklch(1 0 0 / 0.1)" }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.09 0.02 255)" }}>
            {generating ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
            Generate Report
          </button>
        </div>
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "New Leads", value: r.newLeads, icon: Users, color: "oklch(0.72 0.12 75)" },
          { label: "Emails Sent", value: r.emailsSent, icon: Mail, color: "oklch(0.65 0.18 255)" },
          { label: "Replies", value: r.repliesReceived, icon: MessageSquare, color: "oklch(0.72 0.18 142)" },
          { label: "Hot Leads", value: r.hotLeads, icon: TrendingUp, color: "oklch(0.75 0.2 45)" },
        ].map((stat, i) => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-lg p-4"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)", borderTop: `2px solid ${stat.color}` }}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={13} style={{ color: stat.color }} />
              <span className="text-[10px]" style={{ color: "oklch(0.55 0.015 255)" }}>{stat.label}</span>
            </div>
            <div className="font-mono text-2xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Open Rate", value: r.openRate, suffix: "%", color: "oklch(0.72 0.12 75)", note: "Industry avg: 21%" },
          { label: "Reply Rate", value: r.replyRate, suffix: "%", color: "oklch(0.72 0.18 142)", note: "Industry avg: 3%" },
        ].map(stat => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg p-4"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "oklch(0.75 0.008 65)" }}>{stat.label}</span>
              <span className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>{stat.note}</span>
            </div>
            <div className="font-mono text-3xl font-bold mb-2" style={{ color: stat.color }}>
              {stat.value.toFixed(1)}{stat.suffix}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 0.06)" }}>
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
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.92 0.008 65)" }}>7-Day Leads & Emails</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={r.weeklyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.04)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="leads" name="Leads" fill="oklch(0.72 0.12 75 / 0.8)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="emails" name="Emails" fill="oklch(0.65 0.18 255 / 0.8)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-lg p-4"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.92 0.008 65)" }}>7-Day Replies</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={r.weeklyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.04)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="replies" name="Replies" stroke="oklch(0.72 0.18 142)" strokeWidth={2} dot={{ fill: "oklch(0.72 0.18 142)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Summary */}
      {r.summary && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-lg p-4"
          style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.92 0.008 65)" }}>AI Summary</h3>
          <p className="text-sm leading-relaxed" style={{ color: "oklch(0.75 0.008 65)" }}>{r.summary}</p>
        </motion.div>
      )}
    </div>
  );
}
