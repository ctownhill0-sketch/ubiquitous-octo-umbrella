import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle,
  Mail, Shield, TrendingUp, Zap, RotateCcw, ChevronRight,
  Activity, Clock, Send
} from "lucide-react";
import { toast } from "sonner";

type Account = {
  id: number;
  email: string;
  display_name: string;
  is_primary: number;
  warmup_active: number;
  day_number: number;
  daily_limit: number;
  total_sent: number;
  total_received: number;
  reputation_score: number;
  last_warmup_at: string;
};

type RotationAccount = {
  id: number;
  email: string;
  display_name: string;
  is_active: number;
  daily_limit: number;
  sent_today: number;
};

type ReputationSummary = {
  avg_score: number;
  accounts: number;
  active_warmup: number;
  ready_to_send: boolean;
  recommendation: string;
};

const API = "http://localhost:7432";

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "oklch(0.65 0.18 145)" : score >= 50 ? "oklch(0.72 0.12 75)" : "oklch(0.65 0.2 25)";
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="28" cy="28" r="20" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="4" />
        <circle cx="28" cy="28" r="20" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease", strokeLinecap: "round" }} />
      </svg>
      <span className="absolute text-[13px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export default function WarmupSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rotation, setRotation] = useState<RotationAccount[]>([]);
  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"warmup" | "rotation" | "schedule">("warmup");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newLimit, setNewLimit] = useState("50");
  const [isPrimary, setIsPrimary] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [accRes, rotRes, repRes] = await Promise.all([
        fetch(`${API}/api/warmup/accounts`),
        fetch(`${API}/api/warmup/rotation`),
        fetch(`${API}/api/warmup/reputation`),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (rotRes.ok) setRotation(await rotRes.json());
      if (repRes.ok) setReputation(await repRes.json());
    } catch {
      // Demo mode
      setAccounts([
        { id: 1, email: "you@yourdomain.com", display_name: "Your Name", is_primary: 1, warmup_active: 1, day_number: 12, daily_limit: 15, total_sent: 142, total_received: 138, reputation_score: 74, last_warmup_at: "2h ago" },
        { id: 2, email: "outreach@yourdomain.com", display_name: "Outreach", is_primary: 0, warmup_active: 1, day_number: 8, daily_limit: 10, total_sent: 76, total_received: 74, reputation_score: 61, last_warmup_at: "3h ago" },
      ]);
      setRotation([
        { id: 1, email: "you@yourdomain.com", display_name: "Your Name", is_active: 1, daily_limit: 50, sent_today: 23 },
        { id: 2, email: "outreach@yourdomain.com", display_name: "Outreach", is_active: 1, daily_limit: 50, sent_today: 18 },
      ]);
      setReputation({ avg_score: 74, accounts: 2, active_warmup: 2, ready_to_send: true, recommendation: "Domain is warmed up — safe to send cold emails at full volume." });
    }
    setLoading(false);
  };

  const addWarmupAccount = async () => {
    if (!newEmail.trim()) return;
    try {
      const res = await fetch(`${API}/api/warmup/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), display_name: newName.trim(), is_primary: isPrimary }),
      });
      if (res.ok) {
        toast.success(`Added ${newEmail} to warmup`);
        setNewEmail(""); setNewName(""); setIsPrimary(false);
        loadAll();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to add account");
      }
    } catch {
      toast.info("Backend offline — demo mode");
    }
  };

  const addRotationAccount = async () => {
    if (!newEmail.trim()) return;
    try {
      const res = await fetch(`${API}/api/warmup/rotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), display_name: newName.trim(), daily_limit: parseInt(newLimit) || 50 }),
      });
      if (res.ok) {
        toast.success(`Added ${newEmail} to rotation`);
        setNewEmail(""); setNewName(""); setNewLimit("50");
        loadAll();
      } else {
        toast.error("Failed to add account");
      }
    } catch {
      toast.info("Backend offline — demo mode");
    }
  };

  const removeAccount = async (email: string) => {
    try {
      await fetch(`${API}/api/warmup/accounts/${encodeURIComponent(email)}`, { method: "DELETE" });
      toast.success("Account removed");
      loadAll();
    } catch { toast.info("Backend offline"); }
  };

  const simulate = async () => {
    setSimulating(true);
    try {
      const res = await fetch(`${API}/api/warmup/simulate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Warmup simulated — ${data.sent} emails exchanged`);
        loadAll();
      } else {
        toast.error("Simulation failed");
      }
    } catch {
      toast.info("Backend offline — demo mode");
      setAccounts(prev => prev.map(a => ({ ...a, reputation_score: Math.min(a.reputation_score + 2, 100), day_number: Math.min(a.day_number + 1, 30) })));
    }
    setSimulating(false);
  };

  const TABS = [
    { id: "warmup" as const, label: "Warmup Accounts", icon: Flame },
    { id: "rotation" as const, label: "Inbox Rotation", icon: RotateCcw },
    { id: "schedule" as const, label: "Ramp Schedule", icon: TrendingUp },
  ];

  const scheduleData = [
    { days: "Days 1–7", limit: 5, status: "Ramp-up", color: "oklch(0.65 0.2 25)" },
    { days: "Days 8–14", limit: 15, status: "Building", color: "oklch(0.72 0.12 75)" },
    { days: "Days 15–21", limit: 30, status: "Growing", color: "oklch(0.65 0.12 230)" },
    { days: "Days 22–30", limit: 50, status: "Full speed", color: "oklch(0.65 0.18 145)" },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex flex-col overflow-hidden" style={{ width: 240, borderRight: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.09 0.018 255)" }}>
        <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.65 0.2 25 / 0.15)" }}>
              <Flame size={14} style={{ color: "oklch(0.65 0.2 25)" }} />
            </div>
            <span className="text-[13px] font-bold" style={{ color: "oklch(0.88 0.008 65)" }}>Warmup Engine</span>
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.42 0.015 255)" }}>
            Build domain reputation before cold sending
          </p>
        </div>

        {/* Reputation score */}
        {reputation && (
          <div className="mx-3 my-3 p-3 rounded-2xl" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
            <div className="flex items-center gap-3">
              <ScoreRing score={reputation.avg_score} />
              <div>
                <div className="text-[11px] font-bold" style={{ color: "oklch(0.85 0.008 65)" }}>
                  {reputation.ready_to_send ? "Ready to Send" : "Warming Up"}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>
                  {reputation.active_warmup} active · {reputation.accounts} total
                </div>
              </div>
            </div>
            <div className="mt-2 text-[9px] leading-relaxed" style={{ color: reputation.ready_to_send ? "oklch(0.65 0.18 145)" : "oklch(0.72 0.12 75)" }}>
              {reputation.recommendation}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 text-left transition-all"
                style={activeTab === tab.id
                  ? { background: "oklch(0.72 0.12 75 / 0.12)", color: "oklch(0.82 0.14 75)" }
                  : { color: "oklch(0.48 0.015 255)" }}>
                <Icon size={13} />
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Simulate button */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)" }}>
          <button onClick={simulate} disabled={simulating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.2 25), oklch(0.72 0.12 75))", color: "oklch(0.98 0 0)", boxShadow: "0 4px 14px oklch(0.65 0.2 25 / 0.3)" }}>
            {simulating ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
            Run Warmup Now
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === "warmup" && (
            <motion.div key="warmup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Add account form */}
              <div className="rounded-2xl p-5 mb-5" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                <div className="text-[12px] font-bold mb-3" style={{ color: "oklch(0.85 0.008 65)" }}>Add Warmup Account</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="email@yourdomain.com"
                    className="px-3 py-2.5 rounded-xl text-[11px] outline-none"
                    style={{ background: "oklch(0.10 0.020 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.80 0.008 65)" }} />
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Display name (optional)"
                    className="px-3 py-2.5 rounded-xl text-[11px] outline-none"
                    style={{ background: "oklch(0.10 0.020 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.80 0.008 65)" }} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-400" />
                    <span className="text-[10px]" style={{ color: "oklch(0.55 0.015 255)" }}>Primary sending account</span>
                  </label>
                  <button onClick={addWarmupAccount}
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold hover:opacity-90 transition-opacity"
                    style={{ background: "oklch(0.72 0.12 75 / 0.15)", border: "1px solid oklch(0.72 0.12 75 / 0.3)", color: "oklch(0.82 0.14 75)" }}>
                    <Plus size={10} /> Add Account
                  </button>
                </div>
              </div>

              {/* Account cards */}
              <div className="space-y-3">
                {accounts.map((acc, i) => (
                  <motion.div key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="rounded-2xl p-4" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <ScoreRing score={acc.reputation_score} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold" style={{ color: "oklch(0.88 0.008 65)" }}>
                              {acc.display_name || acc.email}
                            </span>
                            {acc.is_primary === 1 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: "oklch(0.72 0.12 75 / 0.15)", color: "oklch(0.82 0.14 75)" }}>
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.45 0.015 255)" }}>{acc.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{ background: acc.warmup_active ? "oklch(0.65 0.18 145 / 0.10)" : "oklch(1 0 0 / 0.05)", border: `1px solid ${acc.warmup_active ? "oklch(0.65 0.18 145 / 0.25)" : "oklch(1 0 0 / 0.08)"}` }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: acc.warmup_active ? "oklch(0.65 0.18 145)" : "oklch(0.45 0.015 255)" }} />
                          <span className="text-[9px] font-semibold" style={{ color: acc.warmup_active ? "oklch(0.65 0.18 145)" : "oklch(0.45 0.015 255)" }}>
                            {acc.warmup_active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <button onClick={() => removeAccount(acc.email)}
                          className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                          style={{ color: "oklch(0.45 0.015 255)" }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Day", value: `${acc.day_number}/30` },
                        { label: "Daily Limit", value: acc.daily_limit },
                        { label: "Total Sent", value: acc.total_sent },
                        { label: "Last Run", value: acc.last_warmup_at || "Never" },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-xl p-2.5 text-center"
                          style={{ background: "oklch(0.10 0.020 255)" }}>
                          <div className="text-[12px] font-bold" style={{ color: "oklch(0.82 0.008 65)" }}>{stat.value}</div>
                          <div className="text-[9px] mt-0.5" style={{ color: "oklch(0.40 0.015 255)" }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px]" style={{ color: "oklch(0.40 0.015 255)" }}>Warmup progress</span>
                        <span className="text-[9px]" style={{ color: "oklch(0.40 0.015 255)" }}>Day {acc.day_number} of 30</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 0.06)" }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(acc.day_number / 30) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          style={{ background: "linear-gradient(90deg, oklch(0.65 0.2 25), oklch(0.72 0.12 75))" }} />
                      </div>
                    </div>
                  </motion.div>
                ))}

                {accounts.length === 0 && !loading && (
                  <div className="text-center py-12" style={{ color: "oklch(0.40 0.015 255)" }}>
                    <Flame size={32} className="mx-auto mb-3 opacity-30" />
                    <div className="text-[12px] font-semibold mb-1">No warmup accounts yet</div>
                    <div className="text-[10px]">Add your sending accounts above to start warming up your domain</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "rotation" && (
            <motion.div key="rotation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="rounded-2xl p-5 mb-5" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                <div className="text-[12px] font-bold mb-1" style={{ color: "oklch(0.85 0.008 65)" }}>Add to Rotation</div>
                <div className="text-[10px] mb-3" style={{ color: "oklch(0.45 0.015 255)" }}>
                  Sends rotate across accounts to stay under per-account limits
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="px-3 py-2.5 rounded-xl text-[11px] outline-none"
                    style={{ background: "oklch(0.10 0.020 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.80 0.008 65)" }} />
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Display name"
                    className="px-3 py-2.5 rounded-xl text-[11px] outline-none"
                    style={{ background: "oklch(0.10 0.020 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.80 0.008 65)" }} />
                  <input value={newLimit} onChange={e => setNewLimit(e.target.value)}
                    placeholder="Daily limit (50)"
                    type="number"
                    className="px-3 py-2.5 rounded-xl text-[11px] outline-none"
                    style={{ background: "oklch(0.10 0.020 255)", border: "1px solid oklch(1 0 0 / 0.09)", color: "oklch(0.80 0.008 65)" }} />
                </div>
                <div className="flex justify-end">
                  <button onClick={addRotationAccount}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold hover:opacity-90 transition-opacity"
                    style={{ background: "oklch(0.55 0.10 230 / 0.15)", border: "1px solid oklch(0.55 0.10 230 / 0.3)", color: "oklch(0.65 0.12 230)" }}>
                    <Plus size={10} /> Add to Rotation
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {rotation.map((acc, i) => {
                  const pct = Math.round((acc.sent_today / acc.daily_limit) * 100);
                  return (
                    <motion.div key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="rounded-2xl p-4" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-[13px] font-bold" style={{ color: "oklch(0.88 0.008 65)" }}>
                            {acc.display_name || acc.email}
                          </div>
                          <div className="text-[10px]" style={{ color: "oklch(0.45 0.015 255)" }}>{acc.email}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[16px] font-bold" style={{ color: "oklch(0.82 0.008 65)" }}>
                            {acc.sent_today}<span className="text-[11px] font-normal" style={{ color: "oklch(0.45 0.015 255)" }}>/{acc.daily_limit}</span>
                          </div>
                          <div className="text-[9px]" style={{ color: "oklch(0.42 0.015 255)" }}>sent today</div>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 0.06)" }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8 }}
                          style={{ background: pct > 80 ? "oklch(0.65 0.2 25)" : pct > 50 ? "oklch(0.72 0.12 75)" : "oklch(0.65 0.18 145)" }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[9px]" style={{ color: "oklch(0.40 0.015 255)" }}>{pct}% of daily limit used</span>
                        <span className="text-[9px]" style={{ color: "oklch(0.40 0.015 255)" }}>{acc.daily_limit - acc.sent_today} remaining</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === "schedule" && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="mb-5 rounded-2xl p-5" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                <div className="text-[13px] font-bold mb-1" style={{ color: "oklch(0.88 0.008 65)" }}>30-Day Warmup Ramp</div>
                <div className="text-[11px]" style={{ color: "oklch(0.48 0.015 255)" }}>
                  Gradually increase send volume to build sender reputation. Never skip ahead.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                {scheduleData.map((phase, i) => (
                  <motion.div key={phase.days} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold" style={{ color: "oklch(0.75 0.008 65)" }}>{phase.days}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${phase.color}15`, color: phase.color, border: `1px solid ${phase.color}30` }}>
                        {phase.status}
                      </span>
                    </div>
                    <div className="text-[28px] font-bold" style={{ color: phase.color }}>{phase.limit}</div>
                    <div className="text-[10px]" style={{ color: "oklch(0.42 0.015 255)" }}>emails/day per account</div>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-2xl p-5" style={{ background: "oklch(0.12 0.022 255)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
                <div className="text-[12px] font-bold mb-3" style={{ color: "oklch(0.85 0.008 65)" }}>Why Warmup Matters</div>
                {[
                  { icon: Shield, text: "New domains sending 100+ emails/day immediately get flagged as spam" },
                  { icon: TrendingUp, text: "A warmed domain can safely send 200–500 cold emails/day across multiple inboxes" },
                  { icon: Activity, text: "Warmup exchanges look like real conversations to email providers" },
                  { icon: CheckCircle2, text: "After 30 days, your domain has a solid reputation and inbox placement improves by 40–60%" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 mb-3 last:mb-0">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "oklch(0.72 0.12 75 / 0.10)" }}>
                        <Icon size={11} style={{ color: "oklch(0.72 0.12 75)" }} />
                      </div>
                      <span className="text-[11px] leading-relaxed" style={{ color: "oklch(0.58 0.015 255)" }}>{item.text}</span>
                    </div>
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
