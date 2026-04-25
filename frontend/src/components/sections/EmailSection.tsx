// LeadStack™ Email Engine — Spintax, preview modal, send schedule, A/B testing
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Send, Sparkles, Eye, X,
  CheckCircle2, Loader2, BarChart3, Plus, Edit3,
  Clock, FlaskConical, Shuffle, Calendar, ChevronDown
} from "lucide-react";
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
    running:   { bg: "oklch(0.65 0.18 145 / 0.12)", color: "oklch(0.72 0.16 145)", border: "oklch(0.65 0.18 145 / 0.25)", label: "Running",   dot: "oklch(0.65 0.18 145)" },
    completed: { bg: "oklch(0.55 0.10 230 / 0.12)", color: "oklch(0.65 0.12 230)", border: "oklch(0.55 0.10 230 / 0.25)", label: "Completed", dot: "oklch(0.55 0.10 230)" },
    paused:    { bg: "oklch(0.72 0.12 75 / 0.12)",  color: "oklch(0.72 0.12 75)",  border: "oklch(0.72 0.12 75 / 0.25)",  label: "Paused",    dot: "oklch(0.72 0.12 75)" },
    draft:     { bg: "oklch(0.45 0.015 255 / 0.12)",color: "oklch(0.55 0.015 255)",border: "oklch(0.45 0.015 255 / 0.25)",label: "Draft",     dot: "oklch(0.45 0.015 255)" },
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

const BASE = "http://localhost:7432/api";

export default function EmailSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEMO_CAMPAIGNS);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaigns" | "compose" | "templates">("campaigns");
  const [subject, setSubject] = useState(TEMPLATE_EMAILS[0].subject);
  const [body, setBody] = useState(TEMPLATE_EMAILS[0].body);
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
      const data = await res.json();
      if (data.campaigns && data.campaigns.length > 0) setCampaigns(data.campaigns);
    } catch { /* offline */ }
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
        style={{ width: 220, borderRight: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.095 0.022 255)" }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center gap-2 mb-0.5">
            <Mail size={13} style={{ color: "oklch(0.72 0.12 75)" }} />
            <span className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Email Engine</span>
          </div>
          <p className="text-[11px]" style={{ color: "oklch(0.42 0.015 255)" }}>Campaigns &amp; outreach</p>
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
                background: "oklch(0.72 0.12 75 / 0.12)",
                color: "oklch(0.90 0.008 65)",
                boxShadow: "0 0 0 1px oklch(0.72 0.12 75 / 0.20)",
              } : { color: "oklch(0.45 0.015 255)" }}>
              <Icon size={14} style={activeTab === tab.id ? { color: "oklch(0.82 0.14 75)" } : {}} />
              {tab.label}
            </button>
          );
        })}
        </div>

        <div className="mx-5 mt-2 pt-4" style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: "oklch(0.38 0.015 255)" }}>Today</div>
          {[
            { label: "Sent", value: "47", color: "oklch(0.72 0.12 75)" },
            { label: "Opened", value: "18", color: "oklch(0.65 0.18 145)" },
            { label: "Replied", value: "4", color: "oklch(0.55 0.10 230)" },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between mb-2">
              <span className="text-[11px]" style={{ color: "oklch(0.48 0.015 255)" }}>{s.label}</span>
              <span className="text-[15px] font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Spintax legend */}
        <div className="mx-5 mt-2 pt-4" style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: "oklch(0.38 0.015 255)" }}>Spintax</div>
          <div className="text-[10px] leading-relaxed" style={{ color: "oklch(0.42 0.015 255)" }}>
            Use <code className="font-mono px-1 py-0.5 rounded text-[9px]" style={{ background: "oklch(1 0 0 / 0.07)", color: "oklch(0.65 0.12 230)" }}>{'{'}Hi|Hello|Hey{'}'}</code> to randomize words per send.
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
                  <h2 className="text-[14px] font-bold" style={{ color: "oklch(0.90 0.008 65)" }}>Campaigns</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>Manage your outreach campaigns</p>
                </div>
                <button onClick={() => setActiveTab("compose")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-90"
                  style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.10 0.025 255)" }}>
                  <Plus size={11} /> New Campaign
                </button>
              </div>
              <div className="space-y-2">
                {campaigns.map((campaign, i) => (
                  <motion.div key={campaign.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl p-5 cursor-pointer transition-all hover:border-white/10"
                    style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: "oklch(0.85 0.008 65)" }}>{campaign.name}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.42 0.015 255)" }}>Created {campaign.createdAt}</div>
                      </div>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: "oklch(0.45 0.015 255)" }}>
                        <span>{campaign.sent} / {campaign.total} sent</span>
                        <span>{Math.round((campaign.sent / Math.max(campaign.total, 1)) * 100)}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.16 0.022 255)" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(campaign.sent / Math.max(campaign.total, 1)) * 100}%`, background: "oklch(0.72 0.12 75)" }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Open Rate", value: `${campaign.openRate}%`, color: "oklch(0.65 0.18 145)" },
                        { label: "Reply Rate", value: `${campaign.replyRate}%`, color: "oklch(0.55 0.10 230)" },
                        { label: "Remaining", value: campaign.total - campaign.sent, color: "oklch(0.72 0.12 75)" },
                      ].map(m => (
                        <div key={m.label} className="rounded-md p-2 text-center" style={{ background: "oklch(0.14 0.022 255)" }}>
                          <div className="text-[13px] font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
                          <div className="text-[9px] mt-0.5" style={{ color: "oklch(0.40 0.015 255)" }}>{m.label}</div>
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
                style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
                <div className="text-[13px] font-semibold" style={{ color: "oklch(0.85 0.008 65)" }}>Compose Email</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowPreview(true); setPreviewVariant(v => v + 1); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all hover:opacity-80"
                    style={{ background: "oklch(0.16 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.55 0.015 255)" }}>
                    <Eye size={10} /> Preview
                  </button>
                  <button onClick={enhanceWithAI} disabled={aiLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all hover:opacity-80"
                    style={{ background: "oklch(0.55 0.10 230 / 0.15)", border: "1px solid oklch(0.55 0.10 230 / 0.3)", color: "oklch(0.65 0.12 230)" }}>
                    {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    AI Enhance
                  </button>
                  <button onClick={sendCampaign} disabled={sendingCampaign}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all hover:opacity-90"
                    style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.10 0.025 255)" }}>
                    {sendingCampaign ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    Launch Campaign
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Subject + A/B */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "oklch(0.42 0.015 255)" }}>
                      Subject Line {abEnabled ? "— Variant A" : ""}
                    </label>
                    <button onClick={() => setAbEnabled(!abEnabled)}
                      className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-medium transition-all"
                      style={abEnabled
                        ? { background: "oklch(0.65 0.22 25 / 0.12)", color: "oklch(0.65 0.22 25)", border: "1px solid oklch(0.65 0.22 25 / 0.25)" }
                        : { background: "oklch(1 0 0 / 0.04)", color: "oklch(0.45 0.015 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                      <FlaskConical size={8} /> A/B Test
                    </button>
                  </div>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none font-medium"
                    style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.90 0.008 65)" }}
                    placeholder="Subject line — use {option A|option B} for spintax..." />
                </div>

                {/* A/B Variant B */}
                <AnimatePresence>
                  {abEnabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "oklch(0.65 0.22 25)" }}>
                        Subject Line — Variant B <span className="font-normal opacity-60">(sent to 50% of leads)</span>
                      </label>
                      <input value={subjectB} onChange={e => setSubjectB(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none font-medium"
                        style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(0.65 0.22 25 / 0.25)", color: "oklch(0.90 0.008 65)" }}
                        placeholder="Alternative subject line..." />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Body */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "oklch(0.42 0.015 255)" }}>
                    Email Body
                  </label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                    className="w-full px-3 py-3 rounded-lg text-[12px] leading-relaxed outline-none resize-none font-mono"
                    style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.78 0.008 65)" }} />
                </div>

                {/* Variables */}
                <div className="rounded-2xl p-4" style={{ background: "oklch(0.55 0.10 230 / 0.06)", border: "1px solid oklch(0.55 0.10 230 / 0.18)" }}>
                  <div className="text-[10px] font-semibold mb-2" style={{ color: "oklch(0.55 0.10 230)" }}>Variables & Spintax</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {["{{first_name}}", "{{company}}", "{{sender_name}}", "{{website}}"].map(v => (
                      <code key={v} onClick={() => setBody(b => b + v)}
                        className="text-[9px] px-1.5 py-0.5 rounded font-mono cursor-pointer hover:opacity-70 transition-opacity"
                        style={{ background: "oklch(0.55 0.10 230 / 0.12)", color: "oklch(0.65 0.12 230)" }}>
                        {v}
                      </code>
                    ))}
                  </div>
                  <div className="text-[9px]" style={{ color: "oklch(0.42 0.015 255)" }}>
                    Spintax: <code className="font-mono" style={{ color: "oklch(0.65 0.22 25)" }}>{"{Hi|Hello|Hey}"}</code> → randomly picks one option per email sent
                  </div>
                </div>

                {/* Send Schedule */}
                <div className="rounded-2xl p-5" style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock size={12} style={{ color: "oklch(0.72 0.12 75)" }} />
                      <span className="text-[12px] font-semibold" style={{ color: "oklch(0.85 0.008 65)" }}>Send Schedule</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.72 0.12 75 / 0.10)", color: "oklch(0.72 0.12 75)" }}>
                        Protects deliverability
                      </span>
                    </div>
                    <button onClick={() => setScheduleEnabled(!scheduleEnabled)}
                      className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                      style={{ background: scheduleEnabled ? "oklch(0.65 0.18 145)" : "oklch(0.22 0.022 255)" }}>
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
                          <div className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "oklch(0.42 0.015 255)" }}>Send Days</div>
                          <div className="flex gap-1.5">
                            {DAY_LABELS.map((day, i) => (
                              <button key={i} onClick={() => setSendDays(prev =>
                                prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                              )}
                                className="w-7 h-7 rounded text-[9px] font-semibold transition-all"
                                style={sendDays.includes(i)
                                  ? { background: "oklch(0.72 0.12 75)", color: "oklch(0.10 0.025 255)" }
                                  : { background: "oklch(0.16 0.022 255)", color: "oklch(0.45 0.015 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Hours + Daily cap */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "oklch(0.42 0.015 255)" }}>Start Hour</div>
                            <select value={sendStartHour} onChange={e => setSendStartHour(+e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-[11px] outline-none"
                              style={{ background: "oklch(0.16 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.78 0.008 65)" }}>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "oklch(0.42 0.015 255)" }}>End Hour</div>
                            <select value={sendEndHour} onChange={e => setSendEndHour(+e.target.value)}
                              className="w-full px-2 py-1.5 rounded text-[11px] outline-none"
                              style={{ background: "oklch(0.16 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.78 0.008 65)" }}>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "oklch(0.42 0.015 255)" }}>Daily Cap</div>
                            <input type="number" value={dailyCap} onChange={e => setDailyCap(+e.target.value)} min={1} max={200}
                              className="w-full px-2 py-1.5 rounded text-[11px] outline-none"
                              style={{ background: "oklch(0.16 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.78 0.008 65)" }} />
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
                <h2 className="text-[14px] font-bold" style={{ color: "oklch(0.90 0.008 65)" }}>Email Templates</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>High-converting cold email templates with built-in spintax</p>
              </div>
              <div className="space-y-3">
                {TEMPLATE_EMAILS.map((tmpl, i) => (
                  <motion.div key={tmpl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl p-5 cursor-pointer transition-all hover:border-white/10"
                    style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}
                    onClick={() => { setSubject(tmpl.subject); setBody(tmpl.body); setActiveTab("compose"); toast.success("Template loaded"); }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12px] font-semibold" style={{ color: "oklch(0.85 0.008 65)" }}>{tmpl.subject}</div>
                      <span className="text-[10px] px-2 py-1 rounded"
                        style={{ background: "oklch(0.72 0.12 75 / 0.12)", color: "oklch(0.72 0.12 75)" }}>
                        Use Template
                      </span>
                    </div>
                    <div className="text-[11px] leading-relaxed" style={{ color: "oklch(0.50 0.015 255)" }}>
                      {tmpl.body.substring(0, 180)}...
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Shuffle size={9} style={{ color: "oklch(0.65 0.22 25)" }} />
                      <span className="text-[9px]" style={{ color: "oklch(0.65 0.22 25)" }}>Includes spintax for deliverability</span>
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
            style={{ background: "oklch(0 0 0 / 0.7)" }}
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-xl rounded-2xl overflow-hidden"
              style={{ background: "oklch(0.13 0.024 255)", border: "1px solid oklch(1 0 0 / 0.12)", boxShadow: "0 40px 80px oklch(0 0 0 / 0.65), 0 0 0 1px oklch(1 0 0 / 0.06)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
                <div className="flex items-center gap-2">
                  <Eye size={14} style={{ color: "oklch(0.72 0.12 75)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>Email Preview</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.65 0.22 25 / 0.12)", color: "oklch(0.65 0.22 25)" }}>
                    Spintax applied
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewVariant(v => v + 1)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all hover:opacity-70"
                    style={{ background: "oklch(1 0 0 / 0.06)", color: "oklch(0.55 0.015 255)" }}>
                    <Shuffle size={9} /> Re-roll
                  </button>
                  <button onClick={() => setShowPreview(false)}
                    className="w-6 h-6 rounded flex items-center justify-center transition-all hover:opacity-70"
                    style={{ background: "oklch(1 0 0 / 0.06)", color: "oklch(0.55 0.015 255)" }}>
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Email preview */}
              <div className="p-5">
                {/* Email meta */}
                <div className="space-y-2 mb-4 pb-4" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
                  <div className="flex gap-3 text-[11px]">
                    <span className="w-12 text-right flex-shrink-0" style={{ color: "oklch(0.42 0.015 255)" }}>From</span>
                    <span style={{ color: "oklch(0.78 0.008 65)" }}>Alex &lt;alex@yourdomain.com&gt;</span>
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <span className="w-12 text-right flex-shrink-0" style={{ color: "oklch(0.42 0.015 255)" }}>To</span>
                    <span style={{ color: "oklch(0.78 0.008 65)" }}>James &lt;james@whitfieldcapital.com&gt;</span>
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <span className="w-12 text-right flex-shrink-0" style={{ color: "oklch(0.42 0.015 255)" }}>Subject</span>
                    <span className="font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>{previewSubject}</span>
                  </div>
                  {abEnabled && subjectB && (
                    <div className="flex gap-3 text-[11px]">
                      <span className="w-12 text-right flex-shrink-0" style={{ color: "oklch(0.65 0.22 25)" }}>Subj B</span>
                      <span className="font-semibold" style={{ color: "oklch(0.90 0.008 65)" }}>{previewSubjectB}</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "oklch(0.78 0.008 65)" }}>
                  {previewBody}
                </div>
              </div>

              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.10 0.020 255)" }}>
                <span className="text-[10px]" style={{ color: "oklch(0.42 0.015 255)" }}>
                  Sample data: James at Whitfield Capital · Each real send gets unique spintax
                </span>
                <button onClick={() => { setShowPreview(false); sendCampaign(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-semibold transition-all hover:opacity-90"
                  style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.10 0.025 255)" }}>
                  <Send size={9} /> Launch Campaign
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
