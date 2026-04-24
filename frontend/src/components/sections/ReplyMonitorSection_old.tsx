// LeadStack™ — Reply Monitor Section
// Monitors Gmail inbox for replies and classifies sentiment
import { motion } from "framer-motion";
import { useState } from "react";
import { RefreshCw, Inbox, Flame, ThumbsDown, HelpCircle, CheckCircle, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getReplies, checkReplies, markReplyRead, type Reply } from "@/lib/api";
import { toast } from "sonner";

const SENTIMENT_CONFIG = {
  Positive: { color: "oklch(0.72 0.18 142)", icon: "✅", bg: "oklch(0.72 0.18 142 / 0.1)" },
  Negative: { color: "oklch(0.65 0.2 25)", icon: "❌", bg: "oklch(0.65 0.2 25 / 0.1)" },
  Neutral: { color: "oklch(0.72 0.12 75)", icon: "💬", bg: "oklch(0.72 0.12 75 / 0.1)" },
};

export default function ReplyMonitorSection() {
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState<"all" | "Positive" | "Negative" | "Neutral">("all");

  const { data: replies, loading, error, refetch } = useApi(getReplies, [], {
    pollInterval: 60000,
    fallback: []
  });

  const allReplies = replies ?? [];
  const filtered = filter === "all" ? allReplies : allReplies.filter(r => r.sentiment === filter);
  const unread = allReplies.filter(r => !r.isRead).length;
  const hot = allReplies.filter(r => r.isHot).length;
  const positive = allReplies.filter(r => r.sentiment === "Positive").length;
  const negative = allReplies.filter(r => r.sentiment === "Negative").length;

  const handleCheckReplies = async () => {
    setChecking(true);
    try {
      const result = await checkReplies();
      toast.success(`Checked inbox — ${result.newReplies} new replies found.`);
      refetch();
    } catch (e) {
      toast.error(`Failed to check: ${e instanceof Error ? e.message : "Backend offline?"}`);
    } finally {
      setChecking(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markReplyRead(id);
      refetch();
    } catch {
      // silent
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>Reply Monitor</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>
            Gmail inbox · AI sentiment classification
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
          <button onClick={handleCheckReplies} disabled={checking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.09 0.02 255)" }}>
            {checking ? <RefreshCw size={13} className="animate-spin" /> : <Inbox size={13} />}
            Check Inbox
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Replies", value: allReplies.length, color: "oklch(0.65 0.18 255)", icon: Inbox },
          { label: "Unread", value: unread, color: "oklch(0.72 0.12 75)", icon: Inbox },
          { label: "Positive", value: positive, color: "oklch(0.72 0.18 142)", icon: CheckCircle },
          { label: "Hot Leads", value: hot, color: "oklch(0.75 0.2 45)", icon: Flame },
        ].map(stat => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg p-3"
            style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)", borderTop: `2px solid ${stat.color}` }}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={12} style={{ color: stat.color }} />
              <span className="text-[10px]" style={{ color: "oklch(0.55 0.015 255)" }}>{stat.label}</span>
            </div>
            <div className="font-mono text-xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(["all", "Positive", "Negative", "Neutral"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: filter === f ? "oklch(0.72 0.12 75 / 0.15)" : "oklch(0.13 0.025 255)",
              color: filter === f ? "oklch(0.72 0.12 75)" : "oklch(0.55 0.015 255)",
              border: `1px solid ${filter === f ? "oklch(0.72 0.12 75 / 0.3)" : "oklch(1 0 0 / 0.07)"}`,
            }}>
            {f === "all" ? `All (${allReplies.length})` : `${f} (${allReplies.filter(r => r.sentiment === f).length})`}
          </button>
        ))}
      </div>

      {/* Reply list */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-lg overflow-hidden"
        style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw size={20} className="animate-spin" style={{ color: "oklch(0.45 0.015 255)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Inbox size={24} style={{ color: "oklch(0.35 0.015 255)", marginBottom: 8 }} />
            <p className="text-xs" style={{ color: "oklch(0.45 0.015 255)" }}>No replies yet.</p>
            <p className="text-[10px] mt-1" style={{ color: "oklch(0.35 0.015 255)" }}>
              {error ? "Backend offline — run the Python server first." : "Click 'Check Inbox' to fetch replies from Gmail."}
            </p>
          </div>
        ) : (
          filtered.map((reply, i) => {
            const cfg = SENTIMENT_CONFIG[reply.sentiment] ?? SENTIMENT_CONFIG.Neutral;
            return (
              <motion.div key={reply.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 p-4 cursor-pointer transition-colors"
                style={{
                  borderBottom: "1px solid oklch(1 0 0 / 0.05)",
                  background: !reply.isRead ? "oklch(0.72 0.12 75 / 0.03)" : "transparent",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "oklch(1 0 0 / 0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = !reply.isRead ? "oklch(0.72 0.12 75 / 0.03)" : "transparent")}
                onClick={() => handleMarkRead(reply.id)}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  {reply.leadName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: "oklch(0.92 0.008 65)" }}>{reply.leadName}</span>
                    <span className="text-[10px]" style={{ color: "oklch(0.55 0.015 255)" }}>{reply.company}</span>
                    {reply.isHot && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "oklch(0.75 0.2 45 / 0.15)", color: "oklch(0.75 0.2 45)" }}>
                        🔥 HOT
                      </span>
                    )}
                    {!reply.isRead && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.72 0.12 75)" }} />
                    )}
                  </div>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "oklch(0.75 0.008 65)" }}>{reply.subject}</p>
                  <p className="text-[11px] line-clamp-2" style={{ color: "oklch(0.55 0.015 255)" }}>{reply.preview}</p>
                </div>
                <div className="flex-shrink-0 text-right space-y-1">
                  <div className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.icon} {reply.sentiment}
                  </div>
                  <div className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>
                    {reply.receivedAt.split(" ")[0]}
                  </div>
                  <div className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>
                    Step {reply.step}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
