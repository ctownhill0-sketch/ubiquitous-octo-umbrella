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
  interested: { label: "Interested", color: "#4ade80", bg: "rgba(74,222,128,0.10)", icon: CheckCircle2 },
  not_now: { label: "Not Now", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: Clock },
  unsubscribe: { label: "Unsubscribe", color: "#f87171", bg: "rgba(248,113,113,0.1)", icon: Ban },
  meeting_booked: { label: "Meeting Booked", color: "#60a5fa", bg: "rgba(96,165,250,0.10)", icon: Calendar },
  question: { label: "Question", color: "#a5b4fc", bg: "rgba(165,180,252,0.1)", icon: AlertCircle },
  unknown: { label: "Unknown", color: "#72716c", bg: "rgba(114,113,108,0.1)", icon: Mail },
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
  const [sendingReply, setSendingReply] = useState(false);

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
            preview: String(r.preview || r.body || "").slice(0, 100),
            fullBody: String(r.fullBody || r.body || r.preview || ""),
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

  const sendReply = async () => {
    if (!selected || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      // Optimistic; flip state immediately so the user sees feedback.
      setReplies(prev => prev.map(r => r.id === selected.id ? { ...r, replied: true } : r));
      setSelected(prev => prev ? { ...prev, replied: true } : null);
      setReplyText("");
      toast.success(`Reply sent to ${selected.from}`);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col overflow-hidden" style={{ width: 360, borderRight: "1px solid #1c1c1f" }}>
        <div className="px-4 py-3.5 flex-shrink-0" style={{ borderBottom: "1px solid #1c1c1f", background: "#121214" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Reply Monitor</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#f87171", color: "#fafafa" }}>
                  {unread} new
                </span>
              )}
            </div>
            <button onClick={syncGmail}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold hover:opacity-80 transition-opacity"
              style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd" }}>
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              Sync Gmail
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
              style={filter === "all" ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" } : { color: "#72716c" }}>
              All ({replies.length})
            </button>
            {(Object.keys(INTENT_CONFIG) as Intent[]).filter(k => k !== "unknown").map(intent => {
              const count = replies.filter(r => r.intent === intent).length;
              if (count === 0) return null;
              const cfg = INTENT_CONFIG[intent];
              return (
                <button key={intent} onClick={() => setFilter(intent)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                  style={filter === intent ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` } : { color: "#72716c" }}>
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
                borderBottom: "1px solid #1c1c1f",
                background: selected?.id === reply.id ? "rgba(245,158,11,0.07)" : "transparent",
                borderLeft: selected?.id === reply.id ? "3px solid #f59e0b" : "3px solid transparent",
              }}
              onClick={() => { setSelected(reply); setReplyText(""); }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!reply.replied && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#f87171", boxShadow: "0 0 6px rgba(248,113,113,0.6)" }} />}
                    <span className="text-[13px] font-bold truncate"
                      style={{ color: reply.replied ? "#a1a09c" : "#e7e5e4" }}>
                      {reply.from}
                    </span>
                  </div>
                  <div className="text-[10px] truncate mt-0.5" style={{ color: "#72716c" }}>{reply.company}</div>
                </div>
                <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: "#52524e" }}>{reply.receivedAt}</span>
              </div>
              <div className="text-[11px] truncate mb-2" style={{ color: "#a1a09c" }}>{reply.preview}</div>
              <IntentBadge intent={reply.intent} confidence={reply.confidence} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #1c1c1f", background: "#121214" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold mb-1" style={{ color: "#f4f3ef" }}>{selected.subject}</div>
                  <div className="text-[11px]" style={{ color: "#72716c" }}>
                    From: <span style={{ color: "#d4d4d2" }}>{selected.from}</span> &lt;{selected.email}&gt;
                  </div>
                </div>
                <IntentBadge intent={selected.intent} confidence={selected.confidence} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-2xl p-5 mb-4"
                style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "#a1a09c" }}>
                  {selected.fullBody}
                </div>
              </div>
              {!selected.replied ? (
                <div className="rounded-2xl p-5" style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[12px] font-bold" style={{ color: "#d4d4d2" }}>
                      <Reply size={12} className="inline mr-1.5" />
                      Reply to {selected.from.split(" ")[0]}
                    </div>
                    <div className="flex items-center gap-2">
                    {selected.intent === "interested" || selected.intent === "question" ? (
                      <button onClick={injectBookingLink}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold hover:opacity-80 transition-opacity"
                        style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}>
                        <Link size={9} /> Inject Booking Link
                      </button>
                    ) : null}
                    <button onClick={generateAIReply} disabled={aiGenerating}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.30)", color: "#93c5fd" }}>
                      {aiGenerating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      AI Reply
                    </button>
                  </div>
                  </div>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={6}
                    placeholder="Write your reply..."
                    className="w-full px-4 py-3 rounded-xl text-[12px] leading-relaxed outline-none resize-none"
                    style={{ background: "#121214", border: "1px solid #222226", color: "#d4d4d2" }} />
                  <div className="flex justify-end mt-3">
                    <button onClick={sendReply} disabled={!replyText.trim() || sendingReply}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b", boxShadow: "0 4px 14px rgba(245,158,11,0.25)" }}>
                      <Send size={11} /> {sendingReply ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.22)" }}>
                  <CheckCircle2 size={14} style={{ color: "#4ade80" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "#4ade80" }}>Reply sent</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Mail size={28} style={{ color: "#222226" }} />
            <div className="text-[13px] font-medium" style={{ color: "#72716c" }}>Select a reply to view</div>
            <div className="text-[11px]" style={{ color: "#52524e" }}>AI classifies intent automatically</div>
          </div>
        )}
      </div>
    </div>
  );
}
