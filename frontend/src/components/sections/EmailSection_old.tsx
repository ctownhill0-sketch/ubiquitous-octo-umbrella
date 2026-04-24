// LeadStack™ — Email Section
// Connects to Python backend to send AI-written cold emails via Gmail
import { motion } from "framer-motion";
import { useState } from "react";
import { Send, Loader2, CheckCircle, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getEmailStatus, sendEmails, type EmailJob } from "@/lib/api";
import { EMAIL_SEQUENCE_DATA } from "@/lib/mockData";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

export default function EmailSection() {
  const [sending, setSending] = useState(false);
  const [sendAll, setSendAll] = useState(true);
  const [step, setStep] = useState(1);

  const { data: emailStatus, loading, refetch } = useApi(getEmailStatus, [], {
    pollInterval: 5000,
    fallback: { id: "", status: "idle", sent: 0, failed: 0 } as EmailJob
  });

  const handleSendEmails = async () => {
    setSending(true);
    try {
      const job = await sendEmails({ all: sendAll, step });
      toast.success(`Email job started — sending to ${sendAll ? "all unsent" : "selected"} leads.`);
      refetch();
    } catch (e) {
      toast.error(`Failed to send: ${e instanceof Error ? e.message : "Backend offline?"}`);
    } finally {
      setSending(false);
    }
  };

  const isRunning = emailStatus?.status === "running";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.92 0.008 65)" }}>Email Engine</h1>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>
            AI-written cold emails via Claude + Gmail OAuth
          </p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "oklch(0.13 0.025 255)", color: "oklch(0.75 0.008 65)", border: "1px solid oklch(1 0 0 / 0.1)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Send Panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-lg p-4 space-y-4"
          style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 65)" }}>Send Campaign</h3>

          {/* Status indicator */}
          <div className="flex items-center gap-2 p-3 rounded-lg"
            style={{ background: isRunning ? "oklch(0.72 0.12 75 / 0.08)" : "oklch(1 0 0 / 0.03)", border: `1px solid ${isRunning ? "oklch(0.72 0.12 75 / 0.2)" : "oklch(1 0 0 / 0.06)"}` }}>
            {isRunning ? (
              <Loader2 size={14} className="animate-spin" style={{ color: "oklch(0.72 0.12 75)" }} />
            ) : emailStatus?.status === "done" ? (
              <CheckCircle size={14} style={{ color: "oklch(0.72 0.18 142)" }} />
            ) : (
              <Mail size={14} style={{ color: "oklch(0.45 0.015 255)" }} />
            )}
            <div>
              <div className="text-xs font-medium" style={{ color: "oklch(0.85 0.008 65)" }}>
                {isRunning ? "Sending emails…" : emailStatus?.status === "done" ? "Last batch complete" : "Ready to send"}
              </div>
              {(emailStatus?.sent ?? 0) > 0 && (
                <div className="text-[10px]" style={{ color: "oklch(0.55 0.015 255)" }}>
                  {emailStatus?.sent} sent · {emailStatus?.failed} failed
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "oklch(0.55 0.015 255)" }}>EMAIL STEP</label>
            <select value={step} onChange={e => setStep(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.85 0.008 65)" }}>
              <option value={1}>Email 1 — Initial outreach</option>
              <option value={2}>Email 2 — Follow-up #1</option>
              <option value={3}>Email 3 — Final follow-up</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "oklch(0.55 0.015 255)" }}>TARGET</label>
            <div className="space-y-2">
              {[
                { value: true, label: "All leads with email (not yet sent step)" },
                { value: false, label: "New leads only (status: new)" },
              ].map(opt => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center"
                    style={{ borderColor: sendAll === opt.value ? "oklch(0.72 0.12 75)" : "oklch(0.35 0.015 255)" }}
                    onClick={() => setSendAll(opt.value)}>
                    {sendAll === opt.value && (
                      <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.72 0.12 75)" }} />
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "oklch(0.75 0.008 65)" }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleSendEmails} disabled={sending || isRunning}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.09 0.02 255)" }}>
            {sending || isRunning ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isRunning ? "Sending…" : "Send Emails"}
          </button>

          <p className="text-[10px] text-center" style={{ color: "oklch(0.45 0.015 255)" }}>
            Emails are written by Claude AI and sent via your Gmail account.
            Requires API keys in Settings.
          </p>
        </motion.div>

        {/* Sequence Performance */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-lg p-4"
          style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.92 0.008 65)" }}>Sequence Performance</h3>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {EMAIL_SEQUENCE_DATA.map(seq => (
              <div key={seq.name} className="rounded-lg p-3"
                style={{ background: "oklch(0.10 0.02 255)", border: "1px solid oklch(1 0 0 / 0.06)" }}>
                <div className="text-[10px] font-medium mb-2" style={{ color: "oklch(0.55 0.015 255)" }}>{seq.name.toUpperCase()}</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "oklch(0.55 0.015 255)" }}>Sent</span>
                    <span className="font-mono font-bold" style={{ color: "oklch(0.85 0.008 65)" }}>{seq.sent}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "oklch(0.55 0.015 255)" }}>Open rate</span>
                    <span className="font-mono font-bold" style={{ color: "oklch(0.72 0.12 75)" }}>{seq.openRate}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "oklch(0.55 0.015 255)" }}>Reply rate</span>
                    <span className="font-mono font-bold" style={{ color: "oklch(0.72 0.18 142)" }}>{seq.replyRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={EMAIL_SEQUENCE_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.45 0.015 255)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sent" name="Sent" fill="oklch(0.65 0.18 255 / 0.6)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="opened" name="Opened" fill="oklch(0.72 0.12 75 / 0.8)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="replied" name="Replied" fill="oklch(0.72 0.18 142)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Email preview note */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-lg p-4"
        style={{ background: "oklch(0.13 0.025 255)", border: "1px solid oklch(1 0 0 / 0.07)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "oklch(0.92 0.008 65)" }}>Email Template Preview</h3>
        <div className="rounded-lg p-4 font-mono text-xs leading-relaxed"
          style={{ background: "oklch(0.10 0.02 255)", color: "oklch(0.75 0.008 65)", border: "1px solid oklch(1 0 0 / 0.06)" }}>
          <p style={{ color: "oklch(0.55 0.015 255)" }}>Subject: Quick question about your follow-up process, [First Name]</p>
          <br />
          <p>Hi [First Name],</p>
          <br />
          <p>I noticed [Company Name] on Google Maps — congrats on the [X-star] rating and [N] reviews. That kind of reputation takes real work.</p>
          <br />
          <p>I'm reaching out because we built InvestReach specifically for independent RIAs like you. It automates your prospect follow-up so no lead goes cold — without you lifting a finger.</p>
          <br />
          <p>Most advisors we work with recover 3–5 lost prospects per month just from better follow-up timing. Worth a 15-minute call?</p>
          <br />
          <p style={{ color: "oklch(0.72 0.12 75)" }}>[Personalized by Claude AI based on lead data]</p>
        </div>
      </motion.div>
    </div>
  );
}
