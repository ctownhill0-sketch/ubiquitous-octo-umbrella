// LeadStack — Sequence Builder (Block 6)
// Visual outreach sequence with email / wait / linkedin / branch step types,
// per-step stats, and a right-pane editor.
import { useState } from "react";
import {
  Mail, Clock, Linkedin, Phone, GitBranch, CheckCircle2, X, Plus,
  Pause, Play, Copy, Settings as Cog, MoreHorizontal, ChevronDown,
  Sparkles, Trash2, ArrowRight,
} from "lucide-react";

type StepType = "start" | "email" | "wait" | "linkedin" | "call" | "branch" | "end";

type Step = {
  id: string;
  type: StepType;
  title: string;
  subtitle?: string;
  day?: number;
  stats?: { sent?: number; opened?: number; replied?: number };
  branch?: { yes: string; no: string };
};

const STEP_META: Record<StepType, { color: string; icon: React.ElementType; label: string }> = {
  start:    { color: "#4ade80", icon: Sparkles,    label: "Start" },
  email:    { color: "#60a5fa", icon: Mail,        label: "Email" },
  wait:     { color: "#fbbf24", icon: Clock,       label: "Delay" },
  linkedin: { color: "#a5b4fc", icon: Linkedin,    label: "LinkedIn" },
  call:     { color: "#f59e0b", icon: Phone,       label: "Call task" },
  branch:   { color: "#a1a09c", icon: GitBranch,   label: "Branch" },
  end:      { color: "#f87171", icon: X,           label: "End" },
};

const INITIAL_STEPS: Step[] = [
  { id: "s1", type: "start",    title: "Lead enters sequence" },
  { id: "s2", type: "email",    title: "Initial outreach",      subtitle: "Step 1 · Day 0",  stats: { sent: 47, opened: 32, replied: 8 } },
  { id: "s3", type: "wait",     title: "Wait 2 days if no reply", day: 2 },
  { id: "s4", type: "email",    title: "Follow-up #1",          subtitle: "Step 2 · Day 2",  stats: { sent: 39, opened: 17, replied: 3 } },
  { id: "s5", type: "branch",   title: "Did they reply?", branch: { yes: "Move to Qualified", no: "Continue" } },
  { id: "s6", type: "linkedin", title: "LinkedIn connection",   subtitle: "Step 3 · Day 5" },
  { id: "s7", type: "email",    title: "Final follow-up",       subtitle: "Step 4 · Day 8 · Last attempt", stats: { sent: 28, opened: 6, replied: 1 } },
  { id: "s8", type: "end",      title: "Mark as Cold if no reply" },
];

export default function SequencesSection() {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [activeStepId, setActiveStepId] = useState<string>("s2");
  const [name, setName] = useState("Webinar Follow-up Q2");
  const [isPaused, setIsPaused] = useState(false);

  const activeStep = steps.find((s) => s.id === activeStepId) ?? null;

  const updateStep = (id: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (activeStepId === id) setActiveStepId("");
  };

  const insertStepAfter = (afterId: string, type: StepType) => {
    const meta = STEP_META[type];
    const newStep: Step = {
      id: `s${Date.now()}`,
      type,
      title: meta.label,
    };
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newStep);
      return next;
    });
  };

  return (
    <div className="flex h-full">
      {/* Builder canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-divider)" }}>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent outline-none text-[16px] font-medium"
              style={{ color: "var(--text-primary)" }}
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`ls-badge ${isPaused ? "ls-badge-muted" : "ls-badge-success"}`} style={{ fontSize: 10 }}>
                {isPaused ? "Paused" : "Active"}
              </span>
              <span className="text-[11px] ls-num" style={{ color: "var(--text-muted)" }}>
                47 enrolled · 68% open · 18% reply
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setIsPaused((p) => !p)} className="ls-btn-ghost">
              {isPaused ? <><Play size={11} /> Resume</> : <><Pause size={11} /> Pause</>}
            </button>
            <button className="ls-btn-ghost"><Copy size={11} /> Duplicate</button>
            <button className="ls-btn-ghost"><Cog size={11} /> Settings</button>
            <button className="ls-btn-ghost" aria-label="More"><MoreHorizontal size={12} /></button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto py-8 px-4">
          <div className="max-w-[460px] mx-auto">
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1;
              const next = steps[i + 1];
              return (
                <div key={step.id}>
                  <StepCard
                    step={step}
                    isActive={step.id === activeStepId}
                    onClick={() => setActiveStepId(step.id)}
                    onDelete={() => removeStep(step.id)}
                  />
                  {!isLast && (
                    <Connector
                      label={connectorLabel(step, next)}
                      onAdd={(type) => insertStepAfter(step.id, type)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right editor pane */}
      {activeStep && (
        <aside
          style={{
            width: 360, flexShrink: 0,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-divider)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <StepEditor
            step={activeStep}
            onChange={(patch) => updateStep(activeStep.id, patch)}
            onClose={() => setActiveStepId("")}
          />
        </aside>
      )}
    </div>
  );
}

function connectorLabel(a: Step, b: Step | undefined): string {
  if (!b) return "";
  if (a.type === "wait" && a.day) return `Wait ${a.day} day${a.day > 1 ? "s" : ""}`;
  if (b.type === "wait") return "If no reply";
  return "Immediately";
}

// ---------- Step Card ----------
function StepCard({
  step, isActive, onClick, onDelete,
}: {
  step: Step;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const meta = STEP_META[step.type];
  const Icon = meta.icon;
  const isStartOrEnd = step.type === "start" || step.type === "end";

  if (step.type === "branch" && step.branch) {
    return (
      <div
        onClick={onClick}
        style={{
          background: isActive ? "var(--amber-soft)" : "var(--bg-panel)",
          border: `1px solid ${isActive ? "rgba(245,158,11,0.4)" : "var(--border-edge)"}`,
          borderRadius: 9,
          padding: 12,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div className="flex items-center gap-2">
          <Icon size={14} color={meta.color} />
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>
            {step.title}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <BranchPath label="If yes" sub={step.branch.yes} color="#4ade80" />
          <BranchPath label="If no"  sub={step.branch.no}  color="#f59e0b" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group"
      style={{
        background: isActive ? "var(--amber-soft)" : "var(--bg-panel)",
        border: `1px solid ${isActive ? "rgba(245,158,11,0.4)" : "var(--border-edge)"}`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 9,
        padding: 12,
        cursor: "pointer",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 7,
          background: `${meta.color}18`,
          border: `1px solid ${meta.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} color={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>
          {step.title}
        </div>
        {step.subtitle && (
          <div className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
            {step.subtitle}
          </div>
        )}
        {step.stats && (
          <div className="flex items-center gap-2 mt-1.5">
            {typeof step.stats.opened === "number" && step.stats.sent ? (
              <span className="text-[10px] ls-num" style={{ color: "#86efac" }}>
                {Math.round((step.stats.opened / step.stats.sent) * 100)}% opened
              </span>
            ) : null}
            {typeof step.stats.replied === "number" && step.stats.sent ? (
              <span className="text-[10px] ls-num" style={{ color: "#fbbf24" }}>
                {Math.round((step.stats.replied / step.stats.sent) * 100)}% replied
              </span>
            ) : null}
          </div>
        )}
      </div>
      {!isStartOrEnd && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
          aria-label="Delete step"
        >
          <Trash2 size={12} color="var(--text-muted)" />
        </button>
      )}
    </div>
  );
}

function BranchPath({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div
      style={{
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 6,
        padding: "6px 10px",
      }}
    >
      <div className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</div>
      <div className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
        {label === "If yes" ? <CheckCircle2 size={10} color="#4ade80" /> : <ArrowRight size={10} />} {sub}
      </div>
    </div>
  );
}

// ---------- Connector ----------
function Connector({ label, onAdd }: { label: string; onAdd: (type: StepType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-col items-center" style={{ height: 36 }}>
      <div
        style={{
          width: 1, height: "100%",
          borderLeft: label === "If no reply" ? "1px dashed rgba(245,158,11,0.5)" : "1px solid var(--border-edge)",
        }}
      />
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 ls-num"
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--border-edge)",
          borderRadius: 999,
          padding: "1px 8px",
          height: 18,
          color: "var(--text-muted)",
          fontSize: 10,
        }}
      >
        <Plus size={9} /> {label}
      </button>

      {open && (
        <div
          className="absolute z-10 left-1/2 -translate-x-1/2 mt-2"
          style={{
            top: "100%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-edge)",
            borderRadius: 8,
            boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
            padding: 6, width: 160,
          }}
        >
          {(Object.keys(STEP_META) as StepType[])
            .filter((t) => t !== "start" && t !== "end")
            .map((t) => {
              const m = STEP_META[t];
              const Icon = m.icon;
              return (
                <button
                  key={t}
                  onClick={() => { onAdd(t); setOpen(false); }}
                  className="w-full flex items-center gap-2 text-[12px] rounded-md"
                  style={{ padding: "6px 8px", color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon size={12} color={m.color} />
                  {m.label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ---------- Editor pane ----------
function StepEditor({
  step, onChange, onClose,
}: {
  step: Step;
  onChange: (patch: Partial<Step>) => void;
  onClose: () => void;
}) {
  const meta = STEP_META[step.type];
  return (
    <>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-divider)" }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <meta.icon size={13} color={meta.color} />
        </div>
        <span className="text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>
          {meta.label} step
        </span>
        <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100" aria-label="Close editor">
          <X size={13} color="var(--text-secondary)" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <Field label="Step name">
          <input
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="ls-input w-full"
          />
        </Field>

        {step.type === "email" && (
          <>
            <Field label="Subject line">
              <input
                placeholder="Quick question, {firstName}"
                className="ls-input w-full"
              />
            </Field>
            <Field label="Body">
              <textarea
                placeholder={`Hi {firstName},\n\nI saw {company} just shipped...`}
                rows={8}
                className="ls-input w-full"
                style={{ height: "auto", padding: "10px 12px", lineHeight: 1.55, resize: "vertical" }}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {["{firstName}", "{company}", "{role}", "{city}"].map((token) => (
                <span
                  key={token}
                  className="ls-num text-[10.5px] px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    color: "var(--amber-text)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  {token}
                </span>
              ))}
            </div>
            <Field label="Send window">
              <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
                <span>Weekdays</span>
                <span style={{ color: "var(--text-ghost)" }}>·</span>
                <span>9am – 11am prospect timezone</span>
                <ChevronDown size={11} color="var(--text-muted)" />
              </div>
            </Field>
            <Field label="">
              <label className="flex items-center gap-2 text-[12px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" />
                A/B test subject line
              </label>
            </Field>
          </>
        )}

        {step.type === "wait" && (
          <Field label="Wait duration">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={step.day ?? 2}
                onChange={(e) => onChange({ day: Math.max(0, Number(e.target.value)) })}
                className="ls-input ls-num"
                style={{ width: 80 }}
              />
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>days</span>
            </div>
          </Field>
        )}

        {step.type === "linkedin" && (
          <Field label="Connection note">
            <textarea
              placeholder={`Hi {firstName} — saw your post on...`}
              rows={4}
              className="ls-input w-full"
              style={{ height: "auto", padding: "10px 12px", resize: "vertical" }}
            />
          </Field>
        )}

        {step.type === "branch" && step.branch && (
          <>
            <Field label="If reply detected">
              <input
                value={step.branch.yes}
                onChange={(e) => onChange({ branch: { ...step.branch!, yes: e.target.value } })}
                className="ls-input w-full"
              />
            </Field>
            <Field label="If no reply">
              <input
                value={step.branch.no}
                onChange={(e) => onChange({ branch: { ...step.branch!, no: e.target.value } })}
                className="ls-input w-full"
              />
            </Field>
          </>
        )}

        {(step.type === "email" || step.type === "linkedin") && (
          <button className="ls-btn-amber-outline w-full justify-center">
            <Mail size={11} /> Preview
          </button>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className="ls-section-label" style={{ padding: 0, marginBottom: 6 }}>{label}</div>}
      {children}
    </div>
  );
}
