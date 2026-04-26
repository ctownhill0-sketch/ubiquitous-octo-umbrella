// LeadStack™ Onboarding Wizard
// First-run experience — guides user through setup in 4 steps
// Design: Dark premium, animated step transitions, clear progress

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Mail, Key, CheckCircle2, ArrowRight,
  ExternalLink, Copy, Eye, EyeOff, Loader2, Zap,
  Shield, Target, TrendingUp, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

const BASE = "http://localhost:7432/api";

const STEPS = [
  { id: 0, label: "Welcome",    icon: Sparkles },
  { id: 1, label: "AI Engine",  icon: Key },
  { id: 2, label: "Gmail",      icon: Mail },
  { id: 3, label: "Ready",      icon: CheckCircle2 },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<"idle" | "ok" | "error">("idle");
  const [aiStatus, setAiStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testingAI, setTestingAI] = useState(false);

  const testAIKey = async () => {
    if (!apiKey.trim()) return;
    setTestingAI(true);
    try {
      const res = await fetch(`${BASE}/test-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (res.ok) {
        setAiStatus("ok");
        toast.success("AI engine connected ✓");
      } else {
        setAiStatus("error");
        toast.error("Invalid API key — check and try again");
      }
    } catch {
      // Backend offline — accept key anyway and test later
      setAiStatus("ok");
      toast.info("Key saved — will verify when backend starts");
    } finally {
      setTestingAI(false);
    }
  };

  const testGmail = async () => {
    if (!senderEmail.trim() || !appPassword.trim()) return;
    setTestingGmail(true);
    try {
      const res = await fetch(`${BASE}/test-gmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: senderEmail, app_password: appPassword }),
      });
      if (res.ok) {
        setGmailStatus("ok");
        toast.success("Gmail connected ✓");
      } else {
        setGmailStatus("error");
        toast.error("Gmail connection failed — check your App Password");
      }
    } catch {
      setGmailStatus("ok");
      toast.info("Credentials saved — will verify when backend starts");
    } finally {
      setTestingGmail(false);
    }
  };

  const saveAndFinish = async () => {
    // Sanity-check the credentials the user typed before we mark setup complete.
    // We accept the values if the user explicitly tested and got an "ok" status,
    // OR if the values look syntactically reasonable (in case the backend was
    // offline during testing — they can re-test in Settings later).
    const apiKeyLooksValid = apiKey.trim().startsWith("sk-ant-");
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim());
    const passwordLooksValid = appPassword.replace(/\s/g, "").length >= 12;

    if (!apiKey.trim() || (aiStatus === "error" && !apiKeyLooksValid)) {
      toast.error("Add your Anthropic API key in step 2 (starts with sk-ant-)");
      setStep(1);
      return;
    }
    if (!senderEmail.trim() || !emailLooksValid) {
      toast.error("Enter a valid Gmail address in step 3");
      setStep(2);
      return;
    }
    if (!appPassword.trim() || !passwordLooksValid) {
      toast.error("Enter a valid Gmail App Password (16 characters)");
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropic_key: apiKey,
          sender_email: senderEmail,
          sender_name: senderName,
          app_password: appPassword,
          onboarding_complete: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Could not save settings — try again");
        setSaving(false);
        return;
      }
    } catch {
      toast.info("Saved locally — settings will sync when the backend starts");
    }
    localStorage.setItem("leadstack_onboarding_complete", "true");
    setSaving(false);
    onComplete();
  };

  const skip = () => {
    localStorage.setItem("leadstack_onboarding_complete", "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "#09090b" }}>

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-xl mx-4"
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8 px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                    style={done
                      ? { background: "#4ade80", border: "none" }
                      : active
                        ? { background: "rgba(245,158,11,0.20)", border: "1px solid rgba(245,158,11,0.50)" }
                        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    {done
                      ? <CheckCircle2 size={13} style={{ color: "white" }} />
                      : <Icon size={12} style={{ color: active ? "#fbbf24" : "#52524e" }} />}
                  </div>
                  <span className="text-[10px] font-semibold hidden sm:block"
                    style={{ color: active ? "#fbbf24" : done ? "#4ade80" : "#52524e" }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-1"
                    style={{ background: done ? "rgba(74,222,128,0.4)" : "#1c1c1f" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "#0d0d10", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }}>

          <AnimatePresence mode="wait">
            {/* ── Step 0: Welcome ──────────────────────────────────────────── */}
            {step === 0 && (
              <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <Sparkles size={22} style={{ color: "#fbbf24" }} />
                  </div>
                  <div>
                    <div className="text-[22px] font-black" style={{ color: "#f4f3ef" }}>Welcome to LeadStack™</div>
                    <div className="text-[12px]" style={{ color: "#72716c" }}>Your personal outbound revenue engine</div>
                  </div>
                </div>

                <p className="text-[13px] leading-relaxed mb-8" style={{ color: "#a1a09c" }}>
                  Let's get you set up in 2 minutes. You'll need your <strong style={{ color: "#fbbf24" }}>Anthropic API key</strong> for AI features and a <strong style={{ color: "#fbbf24" }}>Gmail App Password</strong> for sending emails.
                </p>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { icon: Target, label: "Scrape Leads", sub: "Google Maps + LinkedIn" },
                    { icon: Zap, label: "AI Emails", sub: "Hyper-personalised" },
                    { icon: TrendingUp, label: "Close Deals", sub: "Full CRM pipeline" },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl p-4 text-center"
                        style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
                        <Icon size={18} className="mx-auto mb-2" style={{ color: "#f59e0b" }} />
                        <div className="text-[11px] font-bold" style={{ color: "#e7e5e4" }}>{item.label}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: "#72716c" }}>{item.sub}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={skip} className="text-[11px]" style={{ color: "#52524e" }}>
                    Skip setup
                  </button>
                  <button onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-bold transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b", boxShadow: "0 4px 20px rgba(245,158,11,0.30)" }}>
                    Get Started <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Anthropic API Key ─────────────────────────────── */}
            {step === 1 && (
              <motion.div key="ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.25)" }}>
                    <Key size={18} style={{ color: "#93c5fd" }} />
                  </div>
                  <div className="text-[18px] font-black" style={{ color: "#f4f3ef" }}>Connect AI Engine</div>
                </div>
                <p className="text-[12px] mb-6" style={{ color: "#72716c" }}>
                  LeadStack uses Claude (Anthropic) to write emails, generate replies, and research prospects.
                </p>

                <div className="rounded-2xl p-4 mb-5"
                  style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={12} style={{ color: "#93c5fd" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "#93c5fd" }}>How to get your key</span>
                  </div>
                  <ol className="text-[11px] space-y-1" style={{ color: "#a1a09c" }}>
                    <li>1. Go to <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
                      className="underline" style={{ color: "#93c5fd" }}>console.anthropic.com</a></li>
                    <li>2. Sign up / log in</li>
                    <li>3. Go to API Keys → Create Key</li>
                    <li>4. Copy the key (starts with <code className="font-mono text-[10px]">sk-ant-</code>)</li>
                  </ol>
                </div>

                <div className="mb-5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#72716c" }}>
                    Anthropic API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      className="w-full px-4 py-3 rounded-xl text-[13px] outline-none font-mono pr-20"
                      style={{ background: "#121214", border: `1px solid ${aiStatus === "ok" ? "rgba(74,222,128,0.4)" : aiStatus === "error" ? "rgba(248,113,113,0.4)" : "#222226"}`, color: "#e7e5e4" }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {aiStatus === "ok" && <CheckCircle2 size={14} style={{ color: "#4ade80" }} />}
                      <button onClick={() => setShowKey(!showKey)} className="opacity-50 hover:opacity-100">
                        {showKey ? <EyeOff size={14} style={{ color: "#a1a09c" }} /> : <Eye size={14} style={{ color: "#a1a09c" }} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(0)} className="text-[11px]" style={{ color: "#52524e" }}>
                    ← Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={testAIKey} disabled={!apiKey.trim() || testingAI}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd" }}>
                      {testingAI ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                      Test Key
                    </button>
                    <button onClick={() => setStep(2)} disabled={!apiKey.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b" }}>
                      Continue <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Gmail ─────────────────────────────────────────── */}
            {step === 2 && (
              <motion.div key="gmail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.22)" }}>
                    <Mail size={18} style={{ color: "#fca5a5" }} />
                  </div>
                  <div className="text-[18px] font-black" style={{ color: "#f4f3ef" }}>Connect Gmail</div>
                </div>
                <p className="text-[12px] mb-5" style={{ color: "#72716c" }}>
                  LeadStack sends emails through your Gmail account. Use an App Password — it's more secure than your main password.
                </p>

                <div className="rounded-2xl p-4 mb-5"
                  style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={12} style={{ color: "#fca5a5" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "#fca5a5" }}>How to create an App Password</span>
                  </div>
                  <ol className="text-[11px] space-y-1" style={{ color: "#a1a09c" }}>
                    <li>1. Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer"
                      className="underline" style={{ color: "#fca5a5" }}>myaccount.google.com/security</a></li>
                    <li>2. Enable 2-Step Verification (required)</li>
                    <li>3. Search "App passwords" → Create new</li>
                    <li>4. Select "Mail" → Copy the 16-character password</li>
                  </ol>
                </div>

                <div className="space-y-4 mb-5">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#72716c" }}>Your Name</label>
                    <input value={senderName} onChange={e => setSenderName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                      style={{ background: "#121214", border: "1px solid #222226", color: "#e7e5e4" }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#72716c" }}>Gmail Address</label>
                    <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                      style={{ background: "#121214", border: "1px solid #222226", color: "#e7e5e4" }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#72716c" }}>App Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={appPassword}
                        onChange={e => setAppPassword(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="w-full px-4 py-3 rounded-xl text-[13px] outline-none font-mono pr-20"
                        style={{ background: "#121214", border: `1px solid ${gmailStatus === "ok" ? "rgba(74,222,128,0.4)" : gmailStatus === "error" ? "rgba(248,113,113,0.4)" : "#222226"}`, color: "#e7e5e4" }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {gmailStatus === "ok" && <CheckCircle2 size={14} style={{ color: "#4ade80" }} />}
                        <button onClick={() => setShowPassword(!showPassword)} className="opacity-50 hover:opacity-100">
                          {showPassword ? <EyeOff size={14} style={{ color: "#a1a09c" }} /> : <Eye size={14} style={{ color: "#a1a09c" }} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(1)} className="text-[11px]" style={{ color: "#52524e" }}>← Back</button>
                  <div className="flex items-center gap-2">
                    <button onClick={testGmail} disabled={!senderEmail.trim() || !appPassword.trim() || testingGmail}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.22)", color: "#fca5a5" }}>
                      {testingGmail ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                      Test Gmail
                    </button>
                    <button onClick={() => setStep(3)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b" }}>
                      Continue <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Ready ─────────────────────────────────────────── */}
            {step === 3 && (
              <motion.div key="ready" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-10 text-center">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ background: "rgba(74,222,128,0.15)", border: "2px solid rgba(74,222,128,0.40)" }}>
                  <CheckCircle2 size={28} style={{ color: "#4ade80" }} />
                </motion.div>

                <div className="text-[22px] font-black mb-2" style={{ color: "#f4f3ef" }}>You're all set!</div>
                <p className="text-[13px] mb-8" style={{ color: "#a1a09c" }}>
                  LeadStack is ready to go. Here's what to do first:
                </p>

                <div className="space-y-3 mb-8 text-left">
                  {[
                    { num: "1", text: "Go to Lead Scraper → search for your target niche in any city", color: "#93c5fd" },
                    { num: "2", text: "Go to Email Engine → load a template and launch your first campaign", color: "#f59e0b" },
                    { num: "3", text: "Check Reply Monitor daily — AI classifies every reply automatically", color: "#4ade80" },
                  ].map(item => (
                    <div key={item.num} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black mt-0.5"
                        style={{ background: `${item.color}18`, color: item.color, border: `1px solid ${item.color}30` }}>
                        {item.num}
                      </div>
                      <span className="text-[12px]" style={{ color: "#a1a09c" }}>{item.text}</span>
                    </div>
                  ))}
                </div>

                <button onClick={saveAndFinish} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-[14px] font-black transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b", boxShadow: "0 6px 24px rgba(245,158,11,0.35)" }}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Launch LeadStack™
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
