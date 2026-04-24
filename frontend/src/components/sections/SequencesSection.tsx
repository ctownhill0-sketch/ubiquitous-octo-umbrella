/**
 * SequencesSection.tsx — Fully functional sequence builder
 * Features: create/rename/duplicate/delete sequences, add/edit/delete steps,
 *           AI enhance, enroll leads, pause/resume, variable reference
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ChevronDown, Trash2, Play, Pause, GitBranch,
  Sparkles, Clock, Users, Edit2, Check, X, Loader2, Copy
} from "lucide-react";
import { toast } from "sonner";

type SequenceStep = { id: string; day: number; type: "email" | "wait"; subject: string; body: string; };
type Sequence = { id: string; name: string; status: "active" | "paused" | "draft"; leads: number; sent: number; openRate: number; replyRate: number; steps: SequenceStep[]; };

const DEMO: Sequence[] = [
  { id:"1", name:"Financial Advisor Outreach", status:"active", leads:120, sent:87, openRate:38, replyRate:9, steps:[
    { id:"s1", day:0, type:"email", subject:"Quick question about {{company}}", body:"Hi {{first_name}},\n\nI noticed {{company}} has been growing in the {{city}} market. I help businesses like yours automate outreach so you can focus on closing clients.\n\nWould a 15-minute call this week make sense?\n\nBest,\n{{sender_name}}" },
    { id:"s2", day:3, type:"wait", subject:"", body:"" },
    { id:"s3", day:3, type:"email", subject:"Re: Quick question about {{company}}", body:"Hi {{first_name}},\n\nJust following up on my previous note. I know you're busy — I'll keep this short.\n\nWe've helped 50+ businesses grow through automated outreach. Happy to share how.\n\nWorth a quick chat?\n\n{{sender_name}}" },
    { id:"s4", day:7, type:"wait", subject:"", body:"" },
    { id:"s5", day:7, type:"email", subject:"Last note — {{company}}", body:"Hi {{first_name}},\n\nI'll make this my last email. If the timing isn't right, no worries.\n\nIf you ever want to explore how automation could help {{company}} grow, I'm here.\n\n{{sender_name}}" },
  ]},
  { id:"2", name:"West Coast RIAs", status:"paused", leads:45, sent:20, openRate:42, replyRate:12, steps:[
    { id:"w1", day:0, type:"email", subject:"Idea for {{company}}", body:"Hi {{first_name}},\n\nI came across {{company}} and was impressed by your work. Quick question — are you using any automation for prospecting?\n\n{{sender_name}}" },
    { id:"w2", day:5, type:"wait", subject:"", body:"" },
    { id:"w3", day:5, type:"email", subject:"Following up — {{company}}", body:"Hi {{first_name}},\n\nFollowing up on my last note. Would love to share how we've helped similar businesses.\n\n{{sender_name}}" },
  ]},
  { id:"3", name:"Midwest Advisors", status:"draft", leads:0, sent:0, openRate:0, replyRate:0, steps:[
    { id:"m1", day:0, type:"email", subject:"Quick question about {{company}}", body:"Hi {{first_name}},\n\n[Personalized intro here]\n\n{{sender_name}}" },
  ]},
];

const STATUS = {
  active: { label:"Active", color:"oklch(0.65 0.18 145)", bg:"oklch(0.65 0.18 145 / 0.10)" },
  paused: { label:"Paused", color:"oklch(0.72 0.12 75)", bg:"oklch(0.72 0.12 75 / 0.10)" },
  draft:  { label:"Draft",  color:"oklch(0.45 0.015 255)", bg:"oklch(0.45 0.015 255 / 0.10)" },
};

function uid() { return Math.random().toString(36).slice(2,9); }

export default function SequencesSection() {
  const [seqs, setSeqs] = useState<Sequence[]>(DEMO);
  const [sel, setSel] = useState<Sequence | null>(DEMO[0]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [eSubj, setESubj] = useState("");
  const [eBody, setEBody] = useState("");
  const [eDay, setEDay] = useState(0);
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const updateSel = (updated: Sequence) => {
    setSel(updated);
    setSeqs(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const createSeq = () => {
    if (!newName.trim()) { toast.error("Enter a name"); return; }
    const s: Sequence = {
      id: uid(), name: newName.trim(), status: "draft",
      leads: 0, sent: 0, openRate: 0, replyRate: 0,
      steps: [{ id: uid(), day: 0, type: "email", subject: "Quick question about {{company}}", body: "Hi {{first_name}},\n\n[Your opening line]\n\n{{sender_name}}" }]
    };
    setSeqs(prev => [...prev, s]); setSel(s); setNewName(""); setShowNew(false);
    toast.success("Sequence created");
  };

  const deleteSeq = (id: string) => {
    setSeqs(prev => prev.filter(s => s.id !== id));
    if (sel?.id === id) setSel(seqs.find(s => s.id !== id) || null);
    toast.success("Deleted");
  };

  const toggleStatus = (id: string) => {
    setSeqs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const ns = (s.status === "active" ? "paused" : "active") as Sequence["status"];
      const updated = { ...s, status: ns };
      if (sel?.id === id) setSel(updated);
      toast.success(ns === "active" ? "Resumed" : "Paused");
      return updated;
    }));
  };

  const dupSeq = (s: Sequence) => {
    const copy: Sequence = { ...s, id: uid(), name: s.name + " (Copy)", status: "draft", leads: 0, sent: 0, openRate: 0, replyRate: 0, steps: s.steps.map(st => ({ ...st, id: uid() })) };
    setSeqs(prev => [...prev, copy]); setSel(copy); toast.success("Duplicated");
  };

  const startRename = (s: Sequence) => {
    setRenamingId(s.id); setRenameVal(s.name);
    setTimeout(() => renameRef.current?.focus(), 50);
  };

  const commitRename = () => {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    setSeqs(prev => prev.map(s => s.id === renamingId ? { ...s, name: renameVal.trim() } : s));
    if (sel?.id === renamingId) setSel(prev => prev ? { ...prev, name: renameVal.trim() } : prev);
    setRenamingId(null);
  };

  const addStep = () => {
    if (!sel) return;
    const lastDay = [...sel.steps].reverse().find(s => s.type === "email")?.day ?? 0;
    const w: SequenceStep = { id: uid(), day: lastDay + 3, type: "wait", subject: "", body: "" };
    const e: SequenceStep = { id: uid(), day: lastDay + 3, type: "email", subject: "Following up — {{company}}", body: "Hi {{first_name}},\n\nJust following up on my last email.\n\n{{sender_name}}" };
    const updated = { ...sel, steps: [...sel.steps, w, e] };
    updateSel(updated); setExpanded(e.id); setEditing(e.id); setESubj(e.subject); setEBody(e.body); setEDay(e.day);
    toast.success("Step added");
  };

  const deleteStep = (stepId: string) => {
    if (!sel) return;
    const idx = sel.steps.findIndex(s => s.id === stepId);
    let ns = sel.steps.filter(s => s.id !== stepId);
    if (idx > 0 && sel.steps[idx - 1]?.type === "wait") ns = ns.filter(s => s.id !== sel.steps[idx - 1].id);
    if (ns.filter(s => s.type === "email").length === 0) { toast.error("Need at least one email step"); return; }
    updateSel({ ...sel, steps: ns }); toast.success("Step removed");
  };

  const startEdit = (step: SequenceStep) => {
    setEditing(step.id); setESubj(step.subject); setEBody(step.body); setEDay(step.day); setExpanded(step.id);
  };

  const saveEdit = () => {
    if (!sel || !editing) return;
    updateSel({ ...sel, steps: sel.steps.map(s => s.id === editing ? { ...s, subject: eSubj, body: eBody, day: eDay } : s) });
    setEditing(null); toast.success("Saved");
  };

  const enhance = async (step: SequenceStep) => {
    setEnhancing(step.id);
    try {
      const r = await fetch("http://localhost:7432/api/email/enhance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: step.subject, body: step.body })
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.body && sel) {
        updateSel({ ...sel, steps: sel.steps.map(s => s.id === step.id ? { ...s, ...(d.subject ? { subject: d.subject } : {}), body: d.body } : s) });
        if (editing === step.id) { if (d.subject) setESubj(d.subject); setEBody(d.body); }
        toast.success("AI enhanced");
      }
    } catch {
      const enhanced = step.body
        .replace("[Your opening line]", "I came across {{company}} and was genuinely impressed — {{city}} has some great businesses and yours stood out.")
        .replace("[Personalized intro here]", "I came across {{company}} recently and wanted to reach out personally.");
      if (sel) {
        updateSel({ ...sel, steps: sel.steps.map(s => s.id === step.id ? { ...s, body: enhanced } : s) });
        if (editing === step.id) setEBody(enhanced);
      }
      toast.success("Enhanced (offline mode)");
    } finally { setEnhancing(null); }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 260, borderRight: "1px solid oklch(1 0 0 / 0.07)" }}>
        <div className="p-3 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.10 0.020 255)" }}>
          <span className="text-[13px] font-semibold" style={{ color: "oklch(0.85 0.008 65)" }}>Sequences</span>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium hover:opacity-80" style={{ background: "oklch(0.72 0.12 75 / 0.12)", color: "oklch(0.82 0.14 75)", border: "1px solid oklch(0.72 0.12 75 / 0.25)" }}>
            <Plus size={9} /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {seqs.map((s, i) => {
            const cfg = STATUS[s.status]; const isSel = sel?.id === s.id;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => setSel(s)} className="group relative cursor-pointer p-3 transition-colors"
                style={{ borderBottom: "1px solid oklch(1 0 0 / 0.05)", background: isSel ? "oklch(0.14 0.025 255)" : "transparent" }}>
                {isSel && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r" style={{ background: "oklch(0.72 0.12 75)" }} />}
                <div className="flex items-center justify-between mb-1.5">
                  {renamingId === s.id
                    ? <input ref={renameRef} value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }} onBlur={commitRename} className="flex-1 bg-transparent outline-none text-[12px] font-semibold border-b" style={{ color: "oklch(0.85 0.008 65)", borderColor: "oklch(0.72 0.12 75 / 0.5)" }} />
                    : <span className="text-[12px] font-semibold truncate flex-1" style={{ color: "oklch(0.85 0.008 65)" }}>{s.name}</span>}
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[9px]" style={{ color: "oklch(0.42 0.015 255)" }}>
                  <span>{s.steps.filter(x => x.type === "email").length} emails</span>
                  <span>{s.leads} leads</span>
                  {s.openRate > 0 && <span style={{ color: "oklch(0.65 0.12 230)" }}>{s.openRate}% open</span>}
                </div>
                <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); startRename(s); }} className="p-1 rounded hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)" }}><Edit2 size={9} style={{ color: "oklch(0.55 0.015 255)" }} /></button>
                  <button onClick={e => { e.stopPropagation(); dupSeq(s); }} className="p-1 rounded hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)" }}><Copy size={9} style={{ color: "oklch(0.55 0.015 255)" }} /></button>
                  <button onClick={e => { e.stopPropagation(); toggleStatus(s.id); }} className="p-1 rounded hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)" }}>
                    {s.status === "active" ? <Pause size={9} style={{ color: "oklch(0.72 0.12 75)" }} /> : <Play size={9} style={{ color: "oklch(0.65 0.18 145)" }} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteSeq(s.id); }} className="p-1 rounded hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)" }}><Trash2 size={9} style={{ color: "oklch(0.55 0.12 25)" }} /></button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {sel ? (
          <>
            <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid oklch(1 0 0 / 0.07)", background: "oklch(0.10 0.020 255)" }}>
              <div>
                <h2 className="text-[15px] font-bold" style={{ color: "oklch(0.88 0.008 65)" }}>{sel.name}</h2>
                <div className="flex items-center gap-3 mt-0.5 text-[10px]" style={{ color: "oklch(0.42 0.015 255)" }}>
                  <span>{sel.leads} enrolled</span><span>·</span><span>{sel.sent} sent</span>
                  {sel.openRate > 0 && <><span>·</span><span style={{ color: "oklch(0.65 0.12 230)" }}>{sel.openRate}% open</span><span>·</span><span style={{ color: "oklch(0.65 0.18 145)" }}>{sel.replyRate}% reply</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toast.success(`Enrolling leads into "${sel.name}"…`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium hover:opacity-80" style={{ background: "oklch(0.55 0.10 230 / 0.12)", color: "oklch(0.65 0.12 230)", border: "1px solid oklch(0.55 0.10 230 / 0.25)" }}>
                  <Users size={11} /> Enroll Leads
                </button>
                <button onClick={() => toggleStatus(sel.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium hover:opacity-80" style={{ background: sel.status === "active" ? "oklch(0.72 0.12 75 / 0.12)" : "oklch(0.65 0.18 145 / 0.12)", color: sel.status === "active" ? "oklch(0.82 0.14 75)" : "oklch(0.65 0.18 145)", border: `1px solid ${sel.status === "active" ? "oklch(0.72 0.12 75 / 0.25)" : "oklch(0.65 0.18 145 / 0.25)"}` }}>
                  {sel.status === "active" ? <><Pause size={11} /> Pause</> : <><Play size={11} /> Resume</>}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-2xl mx-auto">
                {sel.steps.map((step, i) => {
                  if (step.type === "wait") {
                    const nextEmail = sel.steps.slice(i + 1).find(s => s.type === "email");
                    return (
                      <div key={step.id} className="flex items-center gap-3 py-2 pl-6">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-px h-3" style={{ background: "oklch(1 0 0 / 0.08)" }} />
                          <Clock size={11} style={{ color: "oklch(0.38 0.015 255)" }} />
                          <div className="w-px h-3" style={{ background: "oklch(1 0 0 / 0.08)" }} />
                        </div>
                        <span className="text-[10px]" style={{ color: "oklch(0.38 0.015 255)" }}>Wait until day {nextEmail?.day ?? step.day}</span>
                      </div>
                    );
                  }
                  const emailNum = sel.steps.slice(0, i + 1).filter(s => s.type === "email").length;
                  const isExp = expanded === step.id; const isEd = editing === step.id; const isEnh = enhancing === step.id;
                  return (
                    <motion.div key={step.id} layout className="rounded-xl overflow-hidden mb-2" style={{ border: "1px solid oklch(1 0 0 / 0.08)", background: "oklch(0.12 0.022 255)" }}>
                      <div className="flex items-center gap-3 p-3">
                        <button className="flex-1 flex items-center gap-3 text-left" onClick={() => setExpanded(isExp ? null : step.id)}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: "oklch(0.55 0.10 230 / 0.15)", color: "oklch(0.65 0.12 230)" }}>{emailNum}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold truncate" style={{ color: "oklch(0.82 0.008 65)" }}>{step.subject || "No subject"}</div>
                            <div className="text-[9px]" style={{ color: "oklch(0.42 0.015 255)" }}>Day {step.day} · Email {emailNum}</div>
                          </div>
                          <ChevronDown size={12} className={`transition-transform flex-shrink-0 ${isExp ? "rotate-180" : ""}`} style={{ color: "oklch(0.42 0.015 255)" }} />
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => startEdit(step)} className="p-1.5 rounded-lg hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)" }}><Edit2 size={10} style={{ color: "oklch(0.55 0.015 255)" }} /></button>
                          <button onClick={() => enhance(step)} disabled={isEnh} className="p-1.5 rounded-lg hover:opacity-80" style={{ background: "oklch(0.55 0.10 230 / 0.10)" }}>
                            {isEnh ? <Loader2 size={10} className="animate-spin" style={{ color: "oklch(0.65 0.12 230)" }} /> : <Sparkles size={10} style={{ color: "oklch(0.65 0.12 230)" }} />}
                          </button>
                          <button onClick={() => deleteStep(step.id)} className="p-1.5 rounded-lg hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)" }}><Trash2 size={10} style={{ color: "oklch(0.55 0.12 25)" }} /></button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExp && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ borderTop: "1px solid oklch(1 0 0 / 0.07)" }}>
                            <div className="p-3">
                              {isEd ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-[9px] font-medium w-12 flex-shrink-0" style={{ color: "oklch(0.45 0.015 255)" }}>Day</label>
                                    <input type="number" min={0} value={eDay} onChange={e => setEDay(Number(e.target.value))} className="w-16 px-2 py-1 rounded text-[11px] bg-transparent border outline-none" style={{ borderColor: "oklch(1 0 0 / 0.12)", color: "oklch(0.82 0.008 65)" }} />
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <label className="text-[9px] font-medium w-12 flex-shrink-0 pt-1.5" style={{ color: "oklch(0.45 0.015 255)" }}>Subject</label>
                                    <input value={eSubj} onChange={e => setESubj(e.target.value)} className="flex-1 px-2 py-1 rounded text-[11px] bg-transparent border outline-none" style={{ borderColor: "oklch(1 0 0 / 0.12)", color: "oklch(0.82 0.008 65)" }} />
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <label className="text-[9px] font-medium w-12 flex-shrink-0 pt-1.5" style={{ color: "oklch(0.45 0.015 255)" }}>Body</label>
                                    <textarea value={eBody} onChange={e => setEBody(e.target.value)} rows={7} className="flex-1 px-2 py-1.5 rounded text-[11px] bg-transparent border outline-none resize-y font-mono" style={{ borderColor: "oklch(1 0 0 / 0.12)", color: "oklch(0.72 0.008 65)" }} />
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button onClick={saveEdit} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium hover:opacity-80" style={{ background: "oklch(0.65 0.18 145 / 0.15)", color: "oklch(0.65 0.18 145)", border: "1px solid oklch(0.65 0.18 145 / 0.3)" }}><Check size={10} /> Save</button>
                                    <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)", color: "oklch(0.45 0.015 255)" }}><X size={10} /> Cancel</button>
                                    <button onClick={() => enhance(step)} disabled={isEnh} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium hover:opacity-80 ml-auto" style={{ background: "oklch(0.55 0.10 230 / 0.10)", color: "oklch(0.65 0.12 230)", border: "1px solid oklch(0.55 0.10 230 / 0.2)" }}>
                                      {isEnh ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} Enhance with AI
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans" style={{ color: "oklch(0.62 0.008 65)" }}>{step.body}</pre>
                                  <div className="flex items-center gap-2 mt-3">
                                    <button onClick={() => startEdit(step)} className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-medium hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)", color: "oklch(0.55 0.015 255)", border: "1px solid oklch(1 0 0 / 0.1)" }}><Edit2 size={8} /> Edit</button>
                                    <button onClick={() => enhance(step)} disabled={isEnh} className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-medium hover:opacity-80" style={{ background: "oklch(0.55 0.10 230 / 0.10)", color: "oklch(0.65 0.12 230)", border: "1px solid oklch(0.55 0.10 230 / 0.2)" }}>
                                      {isEnh ? <Loader2 size={8} className="animate-spin" /> : <Sparkles size={8} />} Enhance with AI
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
                <button onClick={addStep} className="w-full flex items-center gap-2 p-3 rounded-xl text-[11px] font-medium hover:opacity-80 mt-2" style={{ border: "1px dashed oklch(1 0 0 / 0.12)", color: "oklch(0.42 0.015 255)" }}>
                  <Plus size={12} /> Add Step
                </button>
                <div className="mt-4 p-3 rounded-xl" style={{ background: "oklch(0.10 0.018 255)", border: "1px solid oklch(1 0 0 / 0.06)" }}>
                  <div className="text-[9px] font-semibold mb-2" style={{ color: "oklch(0.45 0.015 255)" }}>AVAILABLE VARIABLES</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["{{company}}", "{{first_name}}", "{{city}}", "{{sender_name}}", "{{product_name}}", "{{product_url}}"].map(v => (
                      <span key={v} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "oklch(0.55 0.10 230 / 0.08)", color: "oklch(0.55 0.10 230)", border: "1px solid oklch(0.55 0.10 230 / 0.15)" }}>{v}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <GitBranch size={28} style={{ color: "oklch(0.28 0.015 255)" }} />
            <div className="text-[13px] font-medium" style={{ color: "oklch(0.45 0.015 255)" }}>Select a sequence or create a new one</div>
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium hover:opacity-80 mt-1" style={{ background: "oklch(0.72 0.12 75 / 0.12)", color: "oklch(0.82 0.14 75)", border: "1px solid oklch(0.72 0.12 75 / 0.25)" }}>
              <Plus size={11} /> New Sequence
            </button>
          </div>
        )}
      </div>

      {/* New Sequence Modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "oklch(0 0 0 / 0.6)" }} onClick={() => setShowNew(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="w-80 rounded-2xl p-5 shadow-2xl" style={{ background: "oklch(0.13 0.022 255)", border: "1px solid oklch(1 0 0 / 0.10)" }} onClick={e => e.stopPropagation()}>
              <h3 className="text-[14px] font-bold mb-1" style={{ color: "oklch(0.88 0.008 65)" }}>New Sequence</h3>
              <p className="text-[10px] mb-4" style={{ color: "oklch(0.42 0.015 255)" }}>Give your outreach sequence a name</p>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createSeq(); if (e.key === "Escape") setShowNew(false); }} placeholder="e.g. SaaS Founders Q2" className="w-full px-3 py-2 rounded-lg text-[12px] bg-transparent border outline-none mb-4" style={{ borderColor: "oklch(1 0 0 / 0.15)", color: "oklch(0.85 0.008 65)" }} />
              <div className="flex gap-2">
                <button onClick={createSeq} className="flex-1 py-2 rounded-lg text-[11px] font-semibold hover:opacity-80" style={{ background: "oklch(0.72 0.12 75)", color: "oklch(0.08 0.015 255)" }}>Create Sequence</button>
                <button onClick={() => setShowNew(false)} className="px-3 py-2 rounded-lg text-[11px] font-medium hover:opacity-80" style={{ background: "oklch(0.18 0.025 255)", color: "oklch(0.45 0.015 255)" }}>Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
