import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle2, AlertCircle, XCircle, Zap,
  Mail, Globe, Search, RefreshCw, ChevronRight, Info
} from "lucide-react";
import { API_BASE } from "@/const";
import { toast } from "sonner";

type ContentCheck = {
  score: number;
  grade: string;
  issues: string[];
  warnings: string[];
  spam_triggers: string[];
  word_count: number;
  link_count: number;
  recommendation: string;
};

type DomainCheck = {
  domain: string;
  spf: { found: boolean; status: string; detail: string };
  dmarc: { found: boolean; status: string; detail: string };
  mx: { found: boolean; status: string; detail: string };
  blacklists: { listed: boolean; status: string; checked: string[] };
  health_score: number;
  health_grade: string;
  recommendation: string;
};

type FullCheck = {
  overall_score: number;
  overall_grade: string;
  safe_to_send: boolean;
  content: ContentCheck;
  domain: DomainCheck | null;
  summary: string;
};

const API = API_BASE;

function GradeCircle({ grade, score }: { grade: string; score: number }) {
  const colors: Record<string, string> = {
    A: "#4ade80",
    B: "#93c5fd",
    C: "#f59e0b",
    D: "#f87171",
    F: "#f87171",
  };
  const color = colors[grade] || "#72716c";
  return (
    <div className="flex flex-col items-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
        style={{ background: `${color}15`, border: `3px solid ${color}40`, boxShadow: `0 0 24px ${color}20` }}>
        <span className="text-[32px] font-black" style={{ color }}>{grade}</span>
      </div>
      <span className="text-[11px] font-semibold" style={{ color: "#a1a09c" }}>{score}/100</span>
    </div>
  );
}

function CheckRow({ found, status, detail }: { found: boolean; status: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      {found
        ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
        : <XCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
      }
      <div>
        <div className="text-[11px] font-semibold" style={{ color: found ? "#a1a09c" : "#f87171" }}>
          {status}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "#72716c" }}>{detail}</div>
      </div>
    </div>
  );
}

export default function DeliverabilitySection() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<FullCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [activeTab, setActiveTab] = useState<"check" | "tips">("check");

  const runCheck = async () => {
    if (!subject && !body) {
      toast.error("Enter a subject or body to check");
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`${API}/api/deliverability/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, domain }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.safe_to_send) {
          toast.success(`Score ${data.overall_score}/100 — safe to send`);
        } else {
          toast.warning(`Score ${data.overall_score}/100 — fix issues before sending`);
        }
      } else {
        throw new Error("backend error");
      }
    } catch {
      // Demo result
      const demoScore = subject.toLowerCase().includes("free") || body.toLowerCase().includes("click here") ? 52 : 84;
      const demoResult: FullCheck = {
        overall_score: demoScore,
        overall_grade: demoScore >= 80 ? "B" : demoScore >= 60 ? "C" : "D",
        safe_to_send: demoScore >= 70,
        content: {
          score: demoScore,
          grade: demoScore >= 80 ? "B" : "C",
          issues: demoScore < 70 ? ["Spam trigger word detected: 'free'", "Multiple exclamation marks in subject"] : [],
          warnings: ["No personalisation token found — add {name} for better deliverability"],
          spam_triggers: demoScore < 70 ? ["free", "click here"] : [],
          word_count: body.split(" ").filter(Boolean).length || 45,
          link_count: (body.match(/https?:\/\//g) || []).length,
          recommendation: demoScore >= 70 ? "Email looks good — safe to send." : "Fix spam triggers before sending.",
        },
        domain: domain ? {
          domain,
          spf: { found: true, status: "✓ SPF record found", detail: "SPF authorises which servers can send email for your domain." },
          dmarc: { found: false, status: "✗ No DMARC record — reduces deliverability", detail: "DMARC tells receiving servers how to handle unauthenticated emails." },
          mx: { found: true, status: "✓ MX records found", detail: "MX records direct incoming email to the right server." },
          blacklists: { listed: false, status: "✓ Not on major blacklists", checked: ["Spamhaus", "SORBS", "SpamCop"] },
          health_score: 70,
          health_grade: "C",
          recommendation: "Add a DMARC record to improve deliverability.",
        } : null,
        summary: demoScore >= 70 ? `Ready to send — score ${demoScore}/100.` : `Fix issues before sending — score ${demoScore}/100.`,
      };
      setResult(demoResult);
      toast.info("Backend offline — showing demo analysis");
    }
    setChecking(false);
  };

  const TIPS = [
    { title: "Keep subject lines under 50 characters", detail: "Shorter subjects get more opens and are less likely to be truncated on mobile.", icon: Mail },
    { title: "Use plain text, not HTML", detail: "Plain text emails have 20–30% better deliverability than HTML. Use formatting sparingly.", icon: Shield },
    { title: "One CTA per email", detail: "Multiple links increase spam score. Include one clear call to action.", icon: ChevronRight },
    { title: "Personalise every email", detail: "Emails with the recipient's name get 26% higher open rates and better inbox placement.", icon: Zap },
    { title: "Avoid spam trigger words", detail: "Words like 'free', 'guarantee', 'act now', 'limited time' trigger spam filters immediately.", icon: AlertCircle },
    { title: "Send from a warmed domain", detail: "New domains sending 50+ emails/day immediately get flagged. Warm up for 30 days first.", icon: Globe },
    { title: "Keep emails under 200 words", detail: "Shorter emails get higher reply rates. Get to the point in 3-5 sentences.", icon: Info },
    { title: "Set up SPF, DKIM, and DMARC", detail: "These DNS records authenticate your emails and dramatically improve inbox placement.", icon: CheckCircle2 },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex flex-col overflow-hidden" style={{ width: 240, borderRight: "1px solid #1c1c1f", background: "#09090b" }}>
        <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
              <Shield size={14} style={{ color: "#4ade80" }} />
            </div>
            <span className="text-[13px] font-bold" style={{ color: "#e7e5e4" }}>Deliverability</span>
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: "#72716c" }}>
            Check spam score and domain health before sending
          </p>
        </div>

        <div className="flex-1 px-2 py-2">
          {[
            { id: "check" as const, label: "Email Checker", icon: Search },
            { id: "tips" as const, label: "Best Practices", icon: Info },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 text-left transition-all"
                style={activeTab === tab.id
                  ? { background: "rgba(74,222,128,0.12)", color: "#4ade80" }
                  : { color: "#72716c" }}>
                <Icon size={13} />
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {result && (
          <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid #1c1c1f" }}>
            <div className="rounded-2xl p-3 text-center" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
              <GradeCircle grade={result.overall_grade} score={result.overall_score} />
              <div className="text-[10px] mt-2" style={{ color: result.safe_to_send ? "#4ade80" : "#f87171" }}>
                {result.safe_to_send ? "✓ Safe to send" : "✗ Fix issues first"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === "check" && (
            <motion.div key="check" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Input form */}
              <div className="rounded-2xl p-5 mb-5" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
                <div className="text-[12px] font-bold mb-3" style={{ color: "#e7e5e4" }}>Analyse Your Email</div>
                <div className="space-y-3">
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="Email subject line..."
                    className="w-full px-4 py-3 rounded-xl text-[12px] outline-none"
                    style={{ background: "#121214", border: "1px solid #222226", color: "#d4d4d2" }} />
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                    placeholder="Email body text... (paste your cold email here)"
                    className="w-full px-4 py-3 rounded-xl text-[12px] outline-none resize-none"
                    style={{ background: "#121214", border: "1px solid #222226", color: "#d4d4d2" }} />
                  <input value={domain} onChange={e => setDomain(e.target.value)}
                    placeholder="Sender domain (optional) — e.g. yourdomain.com"
                    className="w-full px-4 py-3 rounded-xl text-[12px] outline-none"
                    style={{ background: "#121214", border: "1px solid #222226", color: "#d4d4d2" }} />
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={runCheck} disabled={checking}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #4ade80, #4ade80)", color: "#fafafa", boxShadow: "0 4px 14px rgba(74,222,128,0.25)" }}>
                    {checking ? <RefreshCw size={11} className="animate-spin" /> : <Shield size={11} />}
                    Run Deliverability Check
                  </button>
                </div>
              </div>

              {/* Results */}
              {result && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  {/* Overall score */}
                  <div className="rounded-2xl p-5 mb-4" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
                    <div className="flex items-center gap-5">
                      <GradeCircle grade={result.overall_grade} score={result.overall_score} />
                      <div className="flex-1">
                        <div className="text-[14px] font-bold mb-1" style={{ color: "#e7e5e4" }}>
                          {result.summary}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ background: result.safe_to_send ? "rgba(74,222,128,0.10)" : "rgba(248,113,113,0.1)", border: `1px solid ${result.safe_to_send ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}` }}>
                            {result.safe_to_send
                              ? <CheckCircle2 size={10} style={{ color: "#4ade80" }} />
                              : <XCircle size={10} style={{ color: "#f87171" }} />
                            }
                            <span className="text-[10px] font-bold" style={{ color: result.safe_to_send ? "#4ade80" : "#f87171" }}>
                              {result.safe_to_send ? "Safe to send" : "Do not send yet"}
                            </span>
                          </div>
                          <span className="text-[10px]" style={{ color: "#72716c" }}>
                            {result.content.word_count} words · {result.content.link_count} links
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Issues */}
                    <div className="rounded-2xl p-4" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
                      <div className="text-[11px] font-bold mb-3" style={{ color: "#e7e5e4" }}>
                        Issues {result.content.issues.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px]" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>{result.content.issues.length}</span>}
                      </div>
                      {result.content.issues.length === 0 ? (
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: "#4ade80" }}>
                          <CheckCircle2 size={12} /> No issues found
                        </div>
                      ) : result.content.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <XCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                          <span className="text-[10px]" style={{ color: "#a1a09c" }}>{issue}</span>
                        </div>
                      ))}
                    </div>

                    {/* Warnings */}
                    <div className="rounded-2xl p-4" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
                      <div className="text-[11px] font-bold mb-3" style={{ color: "#e7e5e4" }}>
                        Warnings {result.content.warnings.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px]" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>{result.content.warnings.length}</span>}
                      </div>
                      {result.content.warnings.length === 0 ? (
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: "#4ade80" }}>
                          <CheckCircle2 size={12} /> No warnings
                        </div>
                      ) : result.content.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <AlertCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                          <span className="text-[10px]" style={{ color: "#a1a09c" }}>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Domain check */}
                  {result.domain && (
                    <div className="rounded-2xl p-4 mt-4" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[11px] font-bold" style={{ color: "#e7e5e4" }}>
                          Domain Health — {result.domain.domain}
                        </div>
                        <div className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd" }}>
                          {result.domain.health_score}/100
                        </div>
                      </div>
                      <CheckRow {...result.domain.spf} />
                      <CheckRow {...result.domain.dmarc} />
                      <CheckRow {...result.domain.mx} />
                      <CheckRow found={!result.domain.blacklists.listed} status={result.domain.blacklists.status} detail={`Checked: ${result.domain.blacklists.checked.join(", ")}`} />
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "tips" && (
            <motion.div key="tips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 gap-4">
                {TIPS.map((tip, i) => {
                  const Icon = tip.icon;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-2xl p-4" style={{ background: "#0d0d10", border: "1px solid #1c1c1f" }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(74,222,128,0.10)" }}>
                          <Icon size={13} style={{ color: "#4ade80" }} />
                        </div>
                        <span className="text-[11px] font-bold" style={{ color: "#d4d4d2" }}>{tip.title}</span>
                      </div>
                      <p className="text-[10px] leading-relaxed" style={{ color: "#a1a09c" }}>{tip.detail}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
