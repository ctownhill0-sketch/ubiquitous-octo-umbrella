// LeadStack™ Reply Monitor — AI intent detection, one-click reply
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, RefreshCw, Sparkles, Send, Reply,
  CheckCircle2, Clock, AlertCircle, Calendar, Ban, Link
} from "lucide-react";
import { toast } from "sonner";

type Intent = "interested" | "not_now" | "unsubscribe" | "meeting_booked" | "question" | "unknown";

type ReplyThread = {
  id: string;
  from: string;
  company: string;
  email: string;
  subject: string;
  preview: string;
  fullBody: string;
  intent: Intent;
  confidence: number;
  receivedAt: string;
  replied: boolean;
};

const DEMO_REPLIES: ReplyThread[] = [
  {
    id: "1", from: "James Whitfield", company: "Whitfield Capital", email: "james@whitfieldcap.com",
    subject: "Re: Quick question about Whitfield Capital",
    preview: "Hi, thanks for reaching out. This actually sounds interesting...",
    fullBody: "Hi,\n\nThanks for reaching out. This actually sounds interesting — we've been looking at ways to improve our follow-up process. Would Thursday at 2pm EST work for a quick call?\n\nBest,\nJames",
    intent: "interested", confidence: 94, receivedAt: "2h ago", replied: false,
  },
  {
    id: "2", from: "Sarah Chen", company: "Chen Financial Group", email: "sarah@chenfinancial.com",
    subject: "Re: Idea for Chen Financial Group",
    preview: "Thanks for the note. We're not in a position to evaluate new tools right now...",
    fullBody: "Thanks for the note. We're not in a position to evaluate new tools right now, but feel free to reach out again in Q3.\n\nSarah",
    intent: "not_now", confidence: 88, receivedAt: "5h ago", replied: false,
  },
  {
    id: "3", from: "Marcus Rivera", company: "Rivera Wealth", email: "m.rivera@riverawealth.com",
    subject: "Re: Quick question about Rivera Wealth Management",
    preview: "Confirmed for Friday 2pm. Looking forward to it.",
    fullBody: "Confirmed for Friday 2pm. Looking forward to it.\n\nMarcus",
    intent: "meeting_booked", confidence: 99, receivedAt: "3h ago", replied: true,
  },
  {
    id: "4", from: "David Park", company: "Park & Associates", email: "david@parkassoc.com",
    subject: "Re: Quick question",
    preview: "Please remove me from your list.",
    fullBody: "Please remove me from your list.\n\nDavid",
    intent: "unsubscribe", confidence: 97, receivedAt: "1d ago", replied: true,
  },
  {
    id: "5", from: "Emily Thompson", company: "Thompson Advisory", email: "emily@thompsonadvisory.com",
    subject: "Re: Idea for Thompson Advisory LLC",
    preview: "Can you tell me more about how the automation works exactly?",
    fullBody: "Can you tell me more about how the automation works exactly? Specifically, how does it integrate with Gmail?\n\nEmily",
    intent: "question", confidence: 85, receivedAt: "6h ago", replied: false,
  },
];

const INTENT_CONFIG: Record<Intent, { label: string; color: string; icon: any; bg: string }> = {
  interested: { label: "Interested", color: "oklch(0.65 0.18 145)", bg: "oklch(0.65 0.18 145 / 0.10)", icon: CheckCircle2 },
  not_now: { label: "Not Now", color: "oklch(0.72 0.12 75)", bg: "oklch(0.72 0.12 75 / 0.10)", icon: Clock },
  unsubscribe: { label: "Unsubscribe", color: "oklch(0.65 0.2 25)", bg: "oklch(0.65 0.2 25 / 0.10)", icon: Ban },
  meeting_booked: { label: "Meeting Booked", color: "oklch(0.55 0.10 230)", bg: "oklch(0.55 0.10 230 / 0.10)", icon: Calendar },
  question: { label: "Question", color: "oklch(0.72 0.16 255)", bg: "oklch(0.72 0.16 255 / 0.10)", icon: AlertCircle },
  unknown: { label: "Unknown", color: "oklch(0.45 0.015 255)", bg: "oklch(0.45 0.015 255 / 0.10)", icon: Mail },
};

function IntentBadge({ intent, confidence }: { intent: Intent; confidence: number }) {
  const cfg = INTENT_CONFIG[intent];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}35` }}>
      <Icon size={10} style={{ color: cfg.color }} />
      <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
      <span className="text-[9px] font-mono" style={{ color: `${cfg.color}90` }}>{confidence}%</span>
    </div>
  );
}

export default function ReplyMonitorSection() {
  const [replies, setReplies] = useState<ReplyThread[]>(DEMO_REPLIES);
  const [selected, setSelected] = useState<ReplyThread | null>(null);
  const [replyText, setReplyText] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [filter, setFilter] = useState<Intent | "all">("all");
  const [syncing, setSyncing] = useState(false);

  // Load real replies from backend on mount
  useEffect(() => {
    const loadReplies = async () => {
      try {
        const res = await fetch("http://localhost:7432/api/replies");
        if (!res.ok) return;
        const data: Array<Record<string, unknown>> = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const validIntents = new Set(["interested","not_now","unsubscribe","meeting_booked","question","unknown"]);
        const mapped: ReplyThread[] = data.map(r => {
          const rawIntent = String(r.sentiment || r.intent || "unknown").toLowerCase();
          const intent = validIntents.has(rawIntent) ? rawIntent as Intent : "unknown";
          return {
            id: String(r.id),
            from: String(r.leadName || r.company || "Unknown"),
            company: String(r.company || r.leadName || ""),
            email: String(r.email || ""),
            subject: String(r.subject || ""),
            preview: String(r.preview || "").slice(0, 100),
            fullBody: String(r.preview || ""),
            intent,
            confidence: intent === "unknown" ? 50 : 85,
            receivedAt: String(r.receivedAt || r.replied_at || "").split("T")[0],
            replied: false,
          };
        });
        if (mapped.length > 0) setReplies(mapped);
      } catch {
        // Backend offline — keep demo data
      }
    };
    loadReplies();
  }, []);

  const filtered = filter === "all" ? replies : replies.filter(r => r.intent === filter);
  const unread = replies.filter(r => !r.replied).length;

  const syncGmail = async () => {
    setSyncing(true);
    try {
      const res = await fetch("http://localhost:7432/api/replies/sync");
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced — ${data.new_replies || 0} new replies`);
      } else {
        toast.info("Backend offline — showing demo replies");
      }
    } catch {
      toast.info("Backend offline — showing demo replies");
    } finally {
      setSyncing(false);
    }
  };

  const generateAIReply = async () => {
    if (!selected) return;
    setAiGenerating(true);
    try {
      const res = await fetch("http://localhost:7432/api/replies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: selected.id, body: selected.fullBody, intent: selected.intent }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplyText(data.reply || data.text || "");
        toast.success("AI reply generated");
      } else {
        throw new Error("backend offline");
      }
    } catch {
      const firstName = selected.from.split(" ")[0];
      const fallbacks: Record<Intent, string> = {
        interested: `Hi ${firstName},\n\nGreat to hear from you! Thursday at 2pm EST works perfectly. I'll send a calendar invite shortly.\n\nLooking forward to connecting!\n\nBest,\n[Your Name]`,
        not_now: `Hi ${firstName},\n\nTotally understand — timing is everything. I'll circle back in Q3. Feel free to reach out if anything changes.\n\nBest,\n[Your Name]`,
        question: `Hi ${firstName},\n\nGreat question! The automation integrates directly with Gmail via OAuth — no passwords shared, just secure API access. It reads replies, classifies intent, and sends follow-ups on your schedule.\n\nWould a quick demo call help clarify?\n\nBest,\n[Your Name]`,
        meeting_booked: `Hi ${firstName},\n\nPerfect — calendar invite sent! Looking forward to our call.\n\nBest,\n[Your Name]`,
        unsubscribe: `Hi ${firstName},\n\nAbsolutely — you've been removed from our list. Sorry for any inconvenience.\n\nBest,\n[Your Name]`,
        unknown: `Hi ${firstName},\n\nThanks for getting back to me! Happy to answer any questions or find a time to connect.\n\nBest,\n[Your Name]`,
      };
      setReplyText(fallbacks[selected.intent] || "");
      toast.info("Backend offline — using template reply");
    } finally {
      setAiGenerating(false);
    }
  };

  const injectBookingLink = async () => {
    if (!selected) return;
    try {
      const res = await fetch("http://localhost:7432/api/email/inject-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText, intent: selected.intent }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplyText(data.body || replyText);
        toast.success("Booking link injected");
      } else {
        // Fallback: append link manually if backend offline
        const linkLine = "\n\nHere's a link to book a time that works for you: [your-calendly-link]";
        setReplyText(prev => prev + linkLine);
        toast.info("Set your Calendly URL in Settings to auto-inject");
      }
    } catch {
      const linkLine = "\n\nHere's a link to book a time that works for you: [your-calendly-link]";
      setReplyText(prev => prev + linkLine);
      toast.info("Set your Calendly URL in Settings to auto-inject");
    }
  };

  const sendReply = () => {
    if (!selected || !replyText.trim()) return;
    setReplies(prev => prev.map(r => r.id === selected.id ? { ...r, replied: true } : r));
    setSelected(prev => prev ? { ...prev, replied: true } : null);
    setReplyText("");
    toast.success(`Reply sent to ${selected.from}`);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col overflow-hidden" style={{ width: 360, borderRight: "1px solid oklch(1 0 0 / 0.07)" }}>
        <div className="px-4 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.10 0.020 255)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-bold" style={{ color: "oklch(0.90 0.008 65)" }}>Reply Monitor</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "oklch(0.65 0.2 25)", color: "oklch(0.98 0 0)" }}>
                  {unread} new
                </span>
              )}
            </div>
            <button onClick={syncGmail}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold hover:opacity-80 transition-opacity"
              style={{ background: "oklch(0.55 0.10 230 / 0.12)", border: "1px solid oklch(0.55 0.10 230 / 0.25)", color: "oklch(0.65 0.12 230)" }}>
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              Sync Gmail
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
              style={filter === "all" ? { background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.82 0.14 75)", border: "1px solid oklch(0.72 0.12 75 / 0.25)" } : { color: "oklch(0.45 0.015 255)" }}>
              All ({replies.length})
            </button>
            {(Object.keys(INTENT_CONFIG) as Intent[]).filter(k => k !== "unknown").map(intent => {
              const count = replies.filter(r => r.intent === intent).length;
              if (count === 0) return null;
              const cfg = INTENT_CONFIG[intent];
              return (
                <button key={intent} onClick={() => setFilter(intent)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                  style={filter === intent ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` } : { color: "oklch(0.45 0.015 255)" }}>
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((reply, i) => (
            <motion.div key={reply.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="px-4 py-3.5 cursor-pointer transition-all"
              style={{
                borderBottom: "1px solid oklch(1 0 0 / 0.06)",
                background: selected?.id === reply.id ? "oklch(0.72 0.12 75 / 0.07)" : "transparent",
                borderLeft: selected?.id === reply.id ? "3px solid oklch(0.72 0.12 75)" : "3px solid transparent",
              }}
              onClick={() => { setSelected(reply); setReplyText(""); }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!reply.replied && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.65 0.2 25)", boxShadow: "0 0 6px oklch(0.65 0.2 25 / 0.6)" }} />}
                    <span className="text-[13px] font-bold truncate"
                      style={{ color: reply.replied ? "oklch(0.52 0.015 255)" : "oklch(0.88 0.008 65)" }}>
                      {reply.from}
                    </span>
                  </div>
                  <div className="text-[10px] truncate mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>{reply.company}</div>
                </div>
                <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: "oklch(0.40 0.015 255)" }}>{reply.receivedAt}</span>
              </div>
              <div className="text-[11px] truncate mb-2" style={{ color: "oklch(0.52 0.015 255)" }}>{reply.preview}</div>
              <IntentBadge intent={reply.intent} confidence={reply.confidence} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.10 0.020 255)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold mb-1" style={{ color: "oklch(0.90 0.008 65)" }}>{selected.subject}</div>
                  <div className="text-[11px]" style={{ color: "oklch(0.48 0.015 255)" }}>
                    From: <span style={{ color: "oklch(0.65 0.008 65)" }}>{selected.from}</span> &lt;{selected.email}&gt;
                  </div>
                </div>
                <IntentBadge intent={selected.intent} confidence={selected.confidence} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "oklch(0.75 0.008 65)" }}>
                  {selected.fullBody}
                </div>
              </div>
              {!selected.replied ? (
                <div className="rounded-2xl p-5" style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[12px] font-bold" style={{ color: "oklch(0.80 0.008 65)" }}>
                      <Reply size={12} className="inline mr-1.5" />
                      Reply to {selected.from.split(" ")[0]}
                    </div>
                    <div className="flex items-center gap-2">
                    {selected.intent === "interested" || selected.intent === "question" ? (
                      <button onClick={injectBookingLink}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold hover:opacity-80 transition-opacity"
                        style={{ background: "oklch(0.65 0.18 145 / 0.12)", border: "1px solid oklch(0.65 0.18 145 / 0.25)", color: "oklch(0.65 0.18 145)" }}>
                        <Link size={9} /> Inject Booking Link
                      </button>
                    ) : null}
                    <button onClick={generateAIReply} disabled={aiGenerating}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold hover:opacity-80 transition-opacity"
                      style={{ background: "oklch(0.55 0.10 230 / 0.15)", border: "1px solid oklch(0.55 0.10 230 / 0.30)", color: "oklch(0.65 0.12 230)" }}>
                      {aiGenerating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      AI Reply
                    </button>
                  </div>
                  </div>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={6}
                    placeholder="Write your reply..."
                    className="w-full px-4 py-3 rounded-xl text-[12px] leading-relaxed outline-none resize-none"
                    style={{ background: "oklch(0.10 0.020 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.80 0.008 65)" }} />
                  <div className="flex justify-end mt-3">
                    <button onClick={sendReply} disabled={!replyText.trim()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, oklch(0.78 0.14 75), oklch(0.68 0.12 65))", color: "oklch(0.10 0.025 255)", boxShadow: "0 4px 14px oklch(0.72 0.12 75 / 0.25)" }}>
                      <Send size={11} /> Send Reply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: "oklch(0.65 0.18 145 / 0.08)", border: "1px solid oklch(0.65 0.18 145 / 0.22)" }}>
                  <CheckCircle2 size={14} style={{ color: "oklch(0.65 0.18 145)" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "oklch(0.65 0.18 145)" }}>Reply sent</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Mail size={28} style={{ color: "oklch(0.28 0.015 255)" }} />
            <div className="text-[13px] font-medium" style={{ color: "oklch(0.45 0.015 255)" }}>Select a reply to view</div>
            <div className="text-[11px]" style={{ color: "oklch(0.35 0.015 255)" }}>AI classifies intent automatically</div>
          </div>
        )}
      </div>
    </div>
  );
}
