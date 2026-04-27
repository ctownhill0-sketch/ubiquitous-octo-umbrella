// LeadStack™ — Settings Section
// Configure API keys, email settings, automation parameters
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Key, Mail, Settings, Calendar, Zap, Link, Map } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { getSettings, saveSettings, healthCheck, type Settings as SettingsType } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsSection() {
  const [saving, setSaving] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  const { data: settings, loading, refetch } = useApi(getSettings, [], {
    fallback: {
      anthropicKey: "",
      senderEmail: "",
      senderName: "",
      followUpDays: [3, 7, 14],
      maxEmailsPerDay: 50,
      scrapeDelay: 2,
      targetKeyword: "independent financial advisor",
      productName: "LeadStack",
      productUrl: "",
      calendlyUrl: "",
      senderSignature: "",
    }
  });

  const [form, setForm] = useState<Partial<SettingsType>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    healthCheck()
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(form);
      toast.success("Settings saved successfully.");
      refetch();
    } catch (e) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : "Backend offline?"}`);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof SettingsType, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "#f4f3ef" }}>Settings</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "#72716c" }}>
            API keys, email config, and automation parameters
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Backend status */}
          <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-xl font-semibold"
            style={{
              background: backendStatus === "online" ? "rgba(74,222,128,0.1)" : backendStatus === "offline" ? "rgba(248,113,113,0.1)" : "rgba(245,158,11,0.10)",
              color: backendStatus === "online" ? "#4ade80" : backendStatus === "offline" ? "#f87171" : "#f59e0b",
              border: `1px solid ${backendStatus === "online" ? "rgba(74,222,128,0.22)" : backendStatus === "offline" ? "rgba(248,113,113,0.22)" : "rgba(245,158,11,0.22)"}`,
            }}>
            {backendStatus === "online" ? <CheckCircle size={12} /> : backendStatus === "offline" ? <AlertCircle size={12} /> : <RefreshCw size={12} className="animate-spin" />}
            Backend {backendStatus}
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-50 transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#09090b", boxShadow: "0 4px 16px rgba(245,158,11,0.30)" }}>
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* API Keys */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)" }}>
              <Key size={14} style={{ color: "#fbbf24" }} />
            </div>
            <h3 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>API Keys</h3>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>
              ANTHROPIC API KEY (Claude AI)
            </label>
            <div className="relative">
              <input
                type={showAnthropicKey ? "text" : "password"}
                value={form.anthropicKey ?? ""}
                onChange={e => set("anthropicKey", e.target.value)}
                placeholder="sk-ant-…"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-[12px] outline-none font-mono"
                style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }}
              />
              <button onClick={() => setShowAnthropicKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "#72716c" }}>
                {showAnthropicKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "#72716c" }}>
              Get your key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>console.anthropic.com</a>
            </p>
          </div>

          <div className="pt-2 space-y-3" style={{ borderTop: "1px solid #1c1c1f" }}>
            <p className="text-[10px] font-medium" style={{ color: "#a1a09c" }}>GMAIL APP PASSWORD</p>
            <div>
              <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>GMAIL ADDRESS</label>
              <input value={form.senderEmail ?? ""} onChange={e => set("senderEmail", e.target.value)}
                placeholder="you@gmail.com" type="email"
                className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
                style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>APP PASSWORD (16 characters)</label>
              <input value={form.appPassword ?? ""} onChange={e => setForm(prev => ({ ...prev, appPassword: e.target.value }))}
                placeholder="xxxx xxxx xxxx xxxx" type="password"
                className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none font-mono"
                style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
              <p className="text-[10px] mt-1" style={{ color: "#72716c" }}>
                Google Account → Security → 2-Step Verification → App Passwords → create one for "Mail".
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer"
                  className="ml-1" style={{ color: "#a5b4fc" }}>Open App Passwords →</a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Email Settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.22)" }}>
              <Mail size={14} style={{ color: "#93c5fd" }} />
            </div>
            <h3 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Email Settings</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>SENDER NAME</label>
              <input value={form.senderName ?? ""} onChange={e => set("senderName", e.target.value)}
                placeholder="Your Name"
                className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
                style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "#72716c" }}>SENDER EMAIL</label>
              <input value={form.senderEmail ?? ""} onChange={e => set("senderEmail", e.target.value)}
                placeholder="you@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
                style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>
              MAX EMAILS PER DAY: <span style={{ color: "#f59e0b" }}>{form.maxEmailsPerDay ?? 50}</span>
            </label>
            <input type="range" min={10} max={200} step={10} value={form.maxEmailsPerDay ?? 50}
              onChange={e => set("maxEmailsPerDay", Number(e.target.value))}
              className="w-full accent-amber-400" />
            <div className="flex justify-between text-[9px] mt-1" style={{ color: "#72716c" }}>
              <span>10</span><span>200</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>FOLLOW-UP SCHEDULE (days)</label>
            <div className="flex items-center gap-2">
              {(form.followUpDays ?? [3, 7, 14]).map((day, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px]" style={{ color: "#72716c" }}>Email {i + 2}:</span>
                  <input type="number" value={day} min={1} max={30}
                    onChange={e => {
                      const days = [...(form.followUpDays ?? [3, 7, 14])];
                      days[i] = Number(e.target.value);
                      set("followUpDays", days);
                    }}
                    className="w-12 px-2 py-1 rounded text-xs text-center outline-none font-mono"
                    style={{ background: "#121214", border: "1px solid rgba(244,243,239,0.1)", color: "#e7e5e4" }} />
                  <span className="text-[10px]" style={{ color: "#72716c" }}>d</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Scraper Settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.22)" }}>
              <Settings size={14} style={{ color: "#86efac" }} />
            </div>
            <h3 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Scraper Settings</h3>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>DEFAULT KEYWORD</label>
            <input value={form.targetKeyword ?? ""} onChange={e => set("targetKeyword", e.target.value)}
              placeholder="independent financial advisor"
              className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
              style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5 flex items-center gap-1.5" style={{ color: "#a1a09c" }}>
              <Map size={10} style={{ color: "#86efac" }} />
              GOOGLE MAPS API KEY
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(74,222,128,0.15)", color: "#86efac" }}>UNLOCKS 60+ RESULTS</span>
            </label>
            <input
              type="password"
              value={(form.googleMapsApiKey as string | undefined) ?? ""}
              onChange={e => setForm(prev => ({ ...prev, googleMapsApiKey: e.target.value }))}
              placeholder="AIzaSy…"
              className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none font-mono"
              style={{ background: "#121214", border: "1px solid rgba(74,222,128,0.25)", color: "#e7e5e4" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "#72716c" }}>
              Uses Google Places API for up to 60 results per query (3 pages × 20). Without a key, the scraper uses HTML parsing (~20 results).
              Get a key at <a href="https://console.cloud.google.com/apis/library/places-backend.googleapis.com" target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>Google Cloud Console →</a>
            </p>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>
              SCRAPE DELAY (seconds): <span style={{ color: "#f59e0b" }}>{form.scrapeDelay ?? 2}s</span>
            </label>
            <input type="range" min={1} max={10} step={0.5} value={form.scrapeDelay ?? 2}
              onChange={e => set("scrapeDelay", Number(e.target.value))}
              className="w-full accent-amber-400" />
            <p className="text-[10px] mt-1" style={{ color: "#72716c" }}>
              Delay between requests to avoid rate limiting. Recommended: 2–4s.
            </p>
          </div>
        </motion.div>

        {/* Product Settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.22)" }}>
              <Zap size={14} style={{ color: "#fca5a5" }} />
            </div>
            <h3 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Product Info</h3>
          </div>
          <p className="text-[10px]" style={{ color: "#72716c" }}>
            Used by Claude AI when writing personalised emails and AI research.
          </p>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>PRODUCT / SERVICE NAME</label>
            <input value={form.productName ?? ""} onChange={e => set("productName", e.target.value)}
              placeholder="e.g. LeadStack, My Consulting, etc."
              className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
              style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "#72716c" }}>WEBSITE / PRODUCT URL</label>
            <input value={form.productUrl ?? ""} onChange={e => set("productUrl", e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
              style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
          </div>
        </motion.div>

        {/* Booking & Automation */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "#121214", border: "1px solid #1c1c1f" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.22)" }}>
              <Calendar size={14} style={{ color: "#93c5fd" }} />
            </div>
            <h3 className="text-[14px] font-bold" style={{ color: "#f4f3ef" }}>Booking & Automation</h3>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>CALENDLY / BOOKING URL</label>
            <div className="relative">
              <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#72716c" }} />
              <input value={form.calendlyUrl ?? ""} onChange={e => set("calendlyUrl", e.target.value)}
                placeholder="https://calendly.com/yourname/30min"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl text-[12px] outline-none"
                style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: "#72716c" }}>
              Auto-injected into reply drafts when a lead shows interest. One click to book.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1.5" style={{ color: "#a1a09c" }}>EMAIL SIGNATURE</label>
            <textarea value={form.senderSignature ?? ""} onChange={e => set("senderSignature", e.target.value)}
              rows={3}
              placeholder={`Best,\nYour Name\nYour Title | yourcompany.com`}
              className="w-full px-3.5 py-2.5 rounded-xl text-[12px] outline-none resize-none font-mono"
              style={{ background: "#121214", border: "1px solid rgba(255,255,255,0.10)", color: "#e7e5e4" }} />
            <p className="text-[10px] mt-1" style={{ color: "#72716c" }}>
              Appended to all outgoing emails automatically.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
