import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, RefreshCw, TrendingUp, Mail, Calendar,
  DollarSign, Target, ChevronRight, Sun, Moon, Coffee
} from "lucide-react";
import { toast } from "sonner";

type BriefingStats = {
  hot_leads: number;
  interested_replies: number;
  emails_sent_yesterday: number;
  open_rate: number;
  pipeline_value: number;
  meetings_booked: number;
};

type Briefing = {
  success: boolean;
  briefing: string;
  generated_at: string;
  stats: BriefingStats;
};

const API = "http://localhost:7432";

const DEMO_BRIEFING = `Good morning — here's your Monday snapshot.

TODAY'S PRIORITIES:
  1. Reply to James Whitfield — he's interested, don't let him go cold.
  2. Follow up with Marcus Rivera — meeting booked, send the calendar invite now.
  3. Review yesterday's 47 sends — 31% open rate is solid, keep the momentum.

WATCH OUT FOR:
  - Emily Thompson asked a question 18 hours ago — answer it before she loses interest.

$24,500 in weighted pipeline. One good week can close two of these. Make it count.`;

export default function DailyBriefingModal({ onClose }: { onClose: () => void }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const GreetingIcon = hour < 12 ? Sun : hour < 17 ? Coffee : Moon;

  useEffect(() => { fetchBriefing(); }, []);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/briefing`);
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      } else {
        throw new Error("backend error");
      }
    } catch {
      // Demo mode
      setBriefing({
        success: false,
        briefing: DEMO_BRIEFING,
        generated_at: new Date().toISOString(),
        stats: {
          hot_leads: 3,
          interested_replies: 2,
          emails_sent_yesterday: 47,
          open_rate: 31,
          pipeline_value: 24500,
          meetings_booked: 1,
        }
      });
    }
    setLoading(false);
  };

  const stats = briefing?.stats;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(9,9,11,0.75)", backdropFilter: "blur(8px)" }}
        onClick={e => e.target === e.currentTarget && onClose()}>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative overflow-hidden"
          style={{
            width: 560,
            maxHeight: "85vh",
            background: "#0d0d10",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 20,
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          }}>

          {/* Gradient header */}
          <div className="relative px-6 pt-6 pb-5"
            style={{ background: "linear-gradient(135deg, #a5b4fc, #121214)", borderBottom: "1px solid #1c1c1f" }}>
            <div className="absolute inset-0 opacity-20"
              style={{ background: "radial-gradient(ellipse at top right, rgba(245,158,11,0.3), transparent 60%)" }} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <GreetingIcon size={16} style={{ color: "#f59e0b" }} />
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#f59e0b" }}>
                    Good {greeting}
                  </span>
                </div>
                <h2 className="text-[20px] font-black" style={{ color: "#f4f3ef" }}>
                  Your Daily Briefing
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "#72716c" }}>
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchBriefing} disabled={loading}
                  className="p-2 rounded-xl hover:opacity-70 transition-opacity"
                  style={{ background: "#1c1c1f" }}>
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} style={{ color: "#a1a09c" }} />
                </button>
                <button onClick={onClose}
                  className="p-2 rounded-xl hover:opacity-70 transition-opacity"
                  style={{ background: "#1c1c1f" }}>
                  <X size={13} style={{ color: "#a1a09c" }} />
                </button>
              </div>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { label: "Hot Leads", value: stats.hot_leads, icon: Target, color: "#f87171" },
                  { label: "Sent Yesterday", value: stats.emails_sent_yesterday, icon: Mail, color: "#93c5fd" },
                  { label: "Open Rate", value: `${stats.open_rate}%`, icon: TrendingUp, color: "#4ade80" },
                  { label: "Pipeline", value: `$${(stats.pipeline_value / 1000).toFixed(0)}k`, icon: DollarSign, color: "#f59e0b" },
                ].map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-xl p-2.5 text-center"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1c1c1f" }}>
                      <Icon size={12} className="mx-auto mb-1" style={{ color: stat.color }} />
                      <div className="text-[15px] font-black" style={{ color: "#e7e5e4" }}>{stat.value}</div>
                      <div className="text-[8px]" style={{ color: "#52524e" }}>{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Briefing content */}
          <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: 340 }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: "rgba(245,158,11,0.12)" }}>
                  <Sparkles size={18} className="animate-pulse" style={{ color: "#f59e0b" }} />
                </div>
                <div className="text-[12px] font-semibold" style={{ color: "#d4d4d2" }}>
                  Claude is reading your pipeline...
                </div>
                <div className="text-[10px] mt-1" style={{ color: "#52524e" }}>
                  Analysing leads, replies, and opportunities
                </div>
              </div>
            ) : briefing ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={12} style={{ color: "#f59e0b" }} />
                  <span className="text-[10px] font-semibold" style={{ color: "#f59e0b" }}>
                    {briefing.success ? "AI-generated briefing" : "Smart briefing"}
                  </span>
                </div>
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap font-mono"
                  style={{ color: "#d4d4d2" }}>
                  {briefing.briefing}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: "1px solid #1c1c1f", background: "#09090b" }}>
            <span className="text-[10px]" style={{ color: "#52524e" }}>
              {briefing ? `Generated ${new Date(briefing.generated_at).toLocaleTimeString()}` : ""}
            </span>
            <button onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b", boxShadow: "0 4px 14px rgba(245,158,11,0.25)" }}>
              Let's go <ChevronRight size={11} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
