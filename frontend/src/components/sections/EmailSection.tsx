// LeadStack™ Email Engine — Spintax, preview modal, send schedule, A/B testing
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Send, Sparkles, Eye, X,
  CheckCircle2, Loader2, BarChart3, Plus, Edit3,
  Clock, FlaskConical, Shuffle, Calendar, ChevronDown
} from "lucide-react";
import { API_BASE } from "@/const";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  sent: number;
  total: number;
  openRate: number;
  replyRate: number;
  createdAt: string;
};

const DEMO_CAMPAIGNS: Campaign[] = [
  { id: "1", name: "Q2 Financial Advisors — NYC", status: "running", sent: 47, total: 120, openRate: 38, replyRate: 9, createdAt: "Apr 9" },
  { id: "2", name: "West Coast RIAs — Spring", status: "completed", sent: 85, total: 85, openRate: 42, replyRate: 12, createdAt: "Apr 3" },
  { id: "3", name: "Midwest Advisors Outreach", status: "paused", sent: 23, total: 60, openRate: 29, replyRate: 5, createdAt: "Apr 1" },
  { id: "4", name: "Southeast Wealth Managers", status: "draft", sent: 0, total: 40, openRate: 0, replyRate: 0, createdAt: "Apr 11" },
];

const TEMPLATE_EMAILS = [
  {
    id: "1",
    subject: "{Quick question|Thought you'd find this interesting|Idea} for {{company}}",
    body: `{Hi|Hello|Hey} {{first_name}},

I came across {{company}} and was impressed by your work.

I'm reaching out because we help {financial advisors|wealth managers|investment professionals} like yourself automate their client acquisition — specifically the prospecting and outreach side that takes up so much time.

Would it make sense to {connect|chat|hop on a call} for 15 minutes this week?

{Best|Thanks|Cheers},
{{sender_name}}`,
  },
  {
    id: "2",
    subject: "{Idea|Quick thought|Something worth seeing} for {{company}}",
    body: `{Hi|Hello|Hey} {{first_name}},

Noticed {{company}} has been growing — {congrats on that|impressive work|that's great to see}.

I work with independent advisors to help them consistently fill their pipeline without spending hours on manual outreach. Most see {3-5|4-6|5-8} qualified conversations per week within 30 days.

Worth a {quick chat|15-minute call|brief conversation}?

{{sender_name}}`,
  },
];

// Spintax parser — picks one option from {a|b|c} randomly
function parseSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_, options) => {
    const choices = options.split("|");
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

// Fill template variables with sample data
function fillVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const config = {
    running:   { bg: "rgba(74,222,128,0.12)", color: "#86efac", border: "rgba(74,222,128,0.25)", label: "Running",   dot: "#4ade80" },
    completed: { bg: "rgba(96,165,250,0.12)", color: "#93c5fd", border: "rgba(96,165,250,0.25)", label: "Completed", dot: "#60a5fa" },
    paused:    { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b",  border: "rgba(245,158,11,0.25)",  label: "Paused",    dot: "#f59e0b" },
    draft:     { bg: "rgba(114,113,108,0.12)",color: "#a1a09c",border: "rgba(114,113,108,0.25)",label: "Draft",     dot: "#72716c" },
  }[status];
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.dot }} />
      {config.label}
    </span>
  );
}

const SAMPLE_DATA = {
  first_name: "James",
  company: "Whitfield Capital",
  sender_name: "Alex",
  website: "whitfieldcapital.com",
};

const BASE = `${API_BASE}/api`;

export default function EmailSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEMO_CAMPAIGNS);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaigns" | "compose" | "templates">("campaigns");
  const [subject, setSubject] = useState(TEMPLATE_EMAILS[0]?.subject ?? "");
  const [body, setBody] = useState(TEMPLATE_EMAILS[0]?.body ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewVariant, setPreviewVariant] = useState(0); // for re-rolling spintax
  const [abEnabled, setAbEnabled] = useState(false);
  const [subjectB, setSubjectB] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [sendStartHour, setSendStartHour] = useState(8);
  const [sendEndHour, setSendEndHour] = useState(18);
  const [sendDays, setSendDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri
  const [dailyCap, setDailyCap] = useState(50);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/email/campaigns`);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.campaigns) && data.campaigns.length > 0) {
        setCampaigns(data.campaigns);
      }
    } catch (e) {
      console.warn("[Email] fetchCampaigns failed:", e);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Preview with spintax applied
  const previewSubject = fillVariables(parseSpintax(subject), SAMPLE_DATA);
  const previewBody = fillVariables(parseSpintax(body), SAMPLE_DATA);
  const previewSubjectB = abEnabled ? fillVariables(parseSpintax(subjectB), SAMPLE_DATA) : "";

  const sendCampaign = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.info("Add a subject and body first");
      return;
    }
    setSendingCampaign(true);
    try {
      const payload: Record<string, unknown> = {
        subject,
        body,
        maxEmails: dailyCap,
        schedule: scheduleEnabled ? {
          startHour: sendStartHour,
          endHour: sendEndHour,
          days: sendDays,
        } : null,
      };
      if (abEnabled && subjectB.trim()) {
        payload.subjectB = subjectB;
        payload.abTest = true;
      }
      const res = await fetch(`${BASE}/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Campaign started — emails sending in background");
        fetchCampaigns();
        setActiveTab("campaigns");
        // Reset the composer for the next campaign.
        setSubject("");
        setBody("");
        setSubjectB("");
        setAbEnabled(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Could not start campaign — check Settings");
      }
    } catch {
      toast.info("Backend offline — start the backend first");
    } finally {
      setSendingCampaign(false);
    }
  };

  const enhanceWithAI = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`${BASE}/email/enhance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
        toast.success("Email enhanced with AI");
      } else {
        toast.info("Backend offline — AI enhancement requires the backend running");
      }
    } catch {
      toast.info("Backend offline — AI enhancement requires the backend running");
    } finally {
      setAiLoading(false);
    }
  };

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <div className="flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ width: 220, borderRight: "1px solid #1c1c1f", background: "#09090b" }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2 mb-0.5">
            <Mail size={13} style={{ color: "#f59e0b" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#f4f3ef" }}>Email Engine</span>
          </div>
          <p className="text-[11px]" style={{ color: "#72716c" }}>Campaigns &amp; outreach</p>
        </div>
        <div className="p-3 space-y-0.5">
        {[
          { id: "campaigns", label: "Campaigns", icon: BarChart3 },
          { id: "compose", label: "Compose", icon: Edit3 },
          { id: "templates", label: "Templates", icon: Mail },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12.5px] font-medium transition-all"
              style={activeTab === tab.id ? {
                background: "rgba(245,158,11,0.12)",
                color: "#f4f3ef",
                boxShadow: "0 0 0 1px rgba(245,158,11,0.20)",
              } : { color: "#72716c" }}>
              <Icon size={14} style={activeTab === tab.id ? { color: "#fbbf24" } : {}} />
              {tab.label}
            </button>
          );
        })}
        </div>

        <div className="mx-5 mt-2 pt-4" style={{ borderTop: "1px solid #1c1c1f" }}>
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "#52524e" }}>Today</div>
          {[
            { label: "Sent", value: "47", color: "#f59e0b" },
            { label: "Opened", value: "18", color: "#4ade80" },
            { label: "Replied", value: "4", color: "#60a5fa" },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between mb-2">
              <span className="text-[11px]" style={{ color: "#72716c" }}>{s.label}</span>
              <span className="text-[15px] font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Spintax legend */}
        <div className="mx-5 mt-2 pt-4" style={{ borderTop: "1px solid #1c1c1f" }}>
          <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "#52524e" }}>Spintax</div>
          <div className="text-[10px] leading-relaxed" style={{ color: "#72716c" }}>
            Use <code className="font-mono px-1 py-0.5 rounded text-[9px]" style={{ background: "#1c1c1f", color: "#93c5fd" }}>{'{'}Hi|Hello|Hey{'}'}</code> to randomize words per send.
          </div>        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "campaigns" && (
            <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Campaigns</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: "#72716c" }}>Manage your outreach campaigns</p>
                </div>
                <button onClick={() => setActiveTab("compose")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-90"
                  style={{ background: "#f59e0b", color: "#09090b" }}>
                  <Plus size={11} /> New Campaign
                </button>
              </div>
              <div className="space-y-2">
                {campaigns.map((campaign, i) => (
                  <motion.div key={campaign.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl p-5 cursor-pointer transition-all hover:border-white/10"
                    style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: "#e7e5e4" }}>{campaign.name}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "#72716c" }}>Created {campaign.createdAt}</div>
                      </div>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: "#72716c" }}>
                        <span>{campaign.sent} / {campaign.total} sent</span>
                        <span>{Math.round((campaign.sent / Math.max(campaign.total, 1)) * 100)}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "#1c1c1f" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(campaign.sent / Math.max(campaign.total, 1)) * 100}%`, background: "#f59e0b" }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Open Rate", value: `${campaign.openRate}%`, color: "#4ade80" },
                        { label: "Reply Rate", value: `${campaign.replyRate}%`, color: "#60a5fa" },
                        { label: "Remaining", value: campaign.total - campaign.sent, color: "#f59e0b" },
                      ].map(m => (
                        <div key={m.label} className="rounded-md p-2 text-center" style={{ background: "#1c1c1f" }}>
                          <div className="text-[13px] font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
                          <div className="text-[9px] mt-0.5" style={{ color: "#52524e" }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "compose" && (
            <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                style={{ borderBottom: "1px solid #1c1c1f" }}>
                <div className="text-[13px] font-semibold" style={{ color: "#e7e5e4" }}>Compose Email</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowPreview(true); setPreviewVariant(v => v + 1); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all hover:opacity-80"
                    style={{ background: "#1c1c1f", border: "1px solid #1c1c1f", color: "#a1a09c" }}>
                    <Eye size={10} /> Preview
                  </button>
                  <button onClick={enhanceWithAI} disabled={aiLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all hover:opacity-80"
                    style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>
                    {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    AI Enhance
                  </button>
                  <button onClick={sendCampaign} disabled={sendingCampaign}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all hover:opacity-90"
                    style={{ background: "#f59e0b", color: "#09090b" }}>
                    {sendingCampaign ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    Launch Campaign
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Subject + A/B */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#72716c" }}>
                      Subject Line {abEnabled ? "— Variant A" : ""}
                    </label>
                    <button onClick={() => setAbEnabled(!abEnabled)}
                      className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-medium transition-all"
                      style={abEnabled
                        ? { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }
                        : { background: "rgba(255,255,255,0.03)", color: "#72716c", border: "1px solid #1c1c1f" }}>
                      <FlaskConical size={8} /> A/B Test
                    </button>
                  </div>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none font-medium"
                    style={{ background: "#0d0d10", border: "1px solid #1c1c1f", color: "#f4f3ef" }}
                    placeholder="Subject line — use {option A|option B} for spintax..." />
                </div>

                {/* A/B Variant B */}
                <AnimatePresence>
                  {abEnabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#f87171" }}>
                        Subject Line — Variant B <span className="font-normal opacity-60">(sent to 50% of leads)</span>
                      </label>
                      <input value={subjectB} onChange={e => setSubjectB(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none font-medium"
                        style={{ background: "#0d0d10", border: "1px solid rgba(248,113,113,0.25)", color: "#f4f3ef" }}
                        placeholder="Alternative subject line..." />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Body */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#72716c" }}>
                    Email Body
                  </label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                    className="w-full px-3 py-3 rounded-lg text-[12px] leading-relaxed outline-none resize-none font-mono"
                    style={{ background: "#0d0d10", border: "1px solid #1c1c1f", color: "#d4d4d2" }} />
                </div>

                {/* Variables */}
                <div className="rounded-2xl p-4" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.18)" }}>
                  <div className="text-[10px] font-semibold mb-2" style={{ color: "#60a5fa" }}>Variables & Spintax</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {["{{first_name}}", "{{company}}", "{{sender_name}}", "{{website}}"].map(v => (
                      <code key={v} onClick={() => setBody(b => b + v)}
                        className="text-[9px] px-1.5 py-0.5 rounded font-mono cursor-pointer hover:opacity-70 transition-opacity"
                        style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd" }}>
                        {v}
                      </code>
                    ))}
                  </div>
                  <div className="text-[9px]" style={{ color: "#72716c" }}>
                    Spintax: <code className="font-mono" style={{ color: "#f87171" }}>{"{Hi|Hello|Hey}"}</code> → randomly picks one option per email sent
                  </div>
                </div>

                {/* Send Schedule */}
                <div className="rounded-2xl p-5" style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock size={12} style={{ color: "#f59e0b" }} />
                      <span className="text-[12px] font-semibold" style={{ color: "#e7e5e4" }}>Send Schedule</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b" }}>
                        Protects deliverability
                      </span>
                    </div>
                    <button onClick={() => setScheduleEnabled(!scheduleEnabled)}
                      className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                      style={{ background: scheduleEnabled ? "#4ade80" : "#222226" }}>
                      <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                        style={{ left: scheduleEnabled ? "calc(100% - 14px)" : "2px" }} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {scheduleEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="space-y-3">
                        {/* Days */}
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#72716c" }}>Send Days</div>
                          <div className="flex gap-1.5">
                            {DAY_LABELS.map((day, i) => (
                              <button key={i} onClick={() => setSendDays(prev =>
                                prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                              )}
                                className="w-7 h-7 rounded text-[9px] font-semibold transition-all"
                                style={sendDays.includes(i)
                                  ? { background: "#f59e0b", color: "#09090b" }
                                  : { background: "#1c1c1f", color: "#72716c", border: "1px solid #1c1c1f" }}>
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Hours + Daily cap */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#72716c" }}>Start Hour</div>
                            <select value={sendStartHour} onChange={e => setSendStartHour(+e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-[11px] outline-none"
                              style={{ background: "#1c1c1f", border: "1px solid #1c1c1f", color: "#d4d4d2" }}>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#72716c" }}>End Hour</div>
                            <select value={sendEndHour} onChange={e => setSendEndHour(+e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-[11px] outline-none"
                              style={{ background: "#1c1c1f", border: "1px solid #1c1c1f", color: "#d4d4d2" }}>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#72716c" }}>Daily Cap</div>
                            <input type="number" value={dailyCap} onChange={e => setDailyCap(+e.target.value)} min={1} max={200}
                              className="w-full px-2 py-1.5 rounded text-[11px] outline-none"
                              style={{ background: "#1c1c1f", border: "1px solid #1c1c1f", color: "#d4d4d2" }} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "templates" && (
            <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-5">
              <div className="mb-4">
                <h2 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Email Templates</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "#72716c" }}>High-converting cold email templates with built-in spintax</p>
              </div>
              <div className="space-y-3">
                {TEMPLATE_EMAILS.map((tmpl, i) => (
                  <motion.div key={tmpl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl p-5 cursor-pointer transition-all hover:border-white/10"
                    style={{ background: "#121214", border: "1px solid #1c1c1f" }}
                    onClick={() => { setSubject(tmpl.subject); setBody(tmpl.body); setActiveTab("compose"); toast.success("Template loaded"); }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] font-semibold" style={{ color: "#e7e5e4" }}>{tmpl.subject}</div>
                      <span className="text-[10px] px-2 py-1 rounded"
                        style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                        Use Template
                      </span>
                    </div>
                    <div className="text-[11px] leading-relaxed" style={{ color: "#a1a09c" }}>
                      {tmpl.body.substring(0, 180)}...
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Shuffle size={9} style={{ color: "#f87171" }} />
                      <span className="text-[9px]" style={{ color: "#f87171" }}>Includes spintax for deliverability</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: "rgba(9,9,11,0.7)" }}
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-xl rounded-2xl overflow-hidden"
              style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 40px 80px rgba(9,9,11,0.65), 0 0 0 1px #1c1c1f" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1c1c1f" }}>
                <div className="flex items-center gap-2">
                  <Eye size={14} style={{ color: "#f59e0b" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "#f4f3ef" }}>Email Preview</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
                    Spintax applied
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewVariant(v => v + 1)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all hover:opacity-70"
                    style={{ background: "#1c1c1f", color: "#a1a09c" }}>
                    <Shuffle size={9} /> Re-roll
                  </button>
                  <button onClick={() => setShowPreview(false)}
                    className="w-6 h-6 rounded flex items-center justify-center transition-all hover:opacity-70"
                    style={{ background: "#1c1c1f", color: "#a1a09c" }}>
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Email preview */}
              <div className="p-5">
                {/* Email meta */}
                <div className="space-y-2 mb-4 pb-4" style={{ borderBottom: "1px solid #1c1c1f" }}>
                  <div className="flex gap-3 text-[11px]">
                    <span className="w-12 text-right flex-shrink-0" style={{ color: "#72716c" }}>From</span>
                    <span style={{ color: "#d4d4d2" }}>Alex &lt;alex@yourdomain.com&gt;</span>
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <span className="w-12 text-right flex-shrink-0" style={{ color: "#72716c" }}>To</span>
                    <span style={{ color: "#d4d4d2" }}>James &lt;james@whitfieldcapital.com&gt;</span>
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <span className="w-12 text-right flex-shrink-0" style={{ color: "#72716c" }}>Subject</span>
                    <span className="font-semibold" style={{ color: "#f4f3ef" }}>{previewSubject}</span>
                  </div>
                  {abEnabled && subjectB && (
                    <div className="flex gap-3 text-[11px]">
                      <span className="w-12 text-right flex-shrink-0" style={{ color: "#f87171" }}>Subj B</span>
                      <span className="font-semibold" style={{ color: "#f4f3ef" }}>{previewSubjectB}</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "#d4d4d2" }}>
                  {previewBody}
                </div>
              </div>

              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #1c1c1f", background: "#121214" }}>
                <span className="text-[10px]" style={{ color: "#72716c" }}>
                  Sample data: James at Whitfield Capital · Each real send gets unique spintax
                </span>
                <button onClick={() => { setShowPreview(false); sendCampaign(); }}
                  disabled={sendingCampaign}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "#f59e0b", color: "#09090b" }}>
                  <Send size={9} /> {sendingCampaign ? "Launching..." : "Launch Campaign"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
