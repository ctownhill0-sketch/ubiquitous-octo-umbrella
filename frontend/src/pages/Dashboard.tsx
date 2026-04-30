// LeadStack — Main Dashboard Page (Precision Dark shell)
import { useEffect, useRef, useState, Suspense, lazy } from "react";
import Sidebar, { SectionId } from "@/components/Sidebar";
import Header from "@/components/Header";
import StatusBar from "@/components/StatusBar";
import CommandPalette from "@/components/CommandPalette";
import DailyBriefingModal from "@/components/DailyBriefingModal";
import OnboardingWizard from "@/components/OnboardingWizard";
import { API_BASE } from "@/const";

const DashboardSection      = lazy(() => import("@/components/sections/DashboardSection"));
const ScraperSection        = lazy(() => import("@/components/sections/ScraperSection"));
const EmailSection          = lazy(() => import("@/components/sections/EmailSection"));
const CRMSection            = lazy(() => import("@/components/sections/CRMSection"));
const ReplyMonitorSection   = lazy(() => import("@/components/sections/ReplyMonitorSection"));
const SettingsSection       = lazy(() => import("@/components/sections/SettingsSection"));
const AnalyticsSection      = lazy(() => import("@/components/sections/AnalyticsSection"));
const SequencesSection      = lazy(() => import("@/components/sections/SequencesSection"));
const WarmupSection         = lazy(() => import("@/components/sections/WarmupSection"));
const DeliverabilitySection = lazy(() => import("@/components/sections/DeliverabilitySection"));
const LinkedInSection       = lazy(() => import("@/components/sections/LinkedInSection"));
const ProspectorSection     = lazy(() => import("@/components/sections/ProspectorSection"));

function LoadingPane() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="space-y-2">
        <div className="ls-skel" style={{ width: 200, height: 14 }} />
        <div className="ls-skel" style={{ width: 160, height: 12 }} />
        <div className="ls-skel" style={{ width: 220, height: 12 }} />
      </div>
    </div>
  );
}

const SECTIONS: Record<SectionId, React.ComponentType> = {
  dashboard:      DashboardSection,
  scraper:        ScraperSection,
  linkedin:       LinkedInSection,
  email:          EmailSection,
  followup:       SequencesSection,
  replies:        ReplyMonitorSection,
  crm:            CRMSection,
  analytics:      AnalyticsSection,
  warmup:         WarmupSection,
  deliverability: DeliverabilitySection,
  prospector:     ProspectorSection,
  settings:       SettingsSection,
};

const SHORTCUTS: Record<string, SectionId> = {
  "1": "dashboard",
  "2": "crm",
  "3": "analytics",
  "4": "email",
  "5": "replies",
};

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [replyCount] = useState(0);
  const [hotLeadCount, setHotLeadCount] = useState(0);
  const [stats, setStats] = useState<{ totalLeads?: number; leadsToday?: number; hotLeads?: number } | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("leadstack_onboarding_complete")
  );
  const [palette, setPalette] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);

  // Backend status + workspace stats — feeds the status bar and the sidebar badge.
  // Sections that mutate leads dispatch `leadstack:data-changed` so we refresh
  // immediately instead of waiting for the 30s poll.
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      // Don't stack requests on slow networks: skip if a fetch is already in
      // flight, and abort any prior poll before starting a fresh one.
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`${API_BASE}/api/stats`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`status ${res.status}`);
        // Defensive parse — a misbehaving backend could return null, an empty
        // body, or non-JSON. Treat any of those as "no data" instead of
        // crashing on `null.totalLeads`.
        const raw = await res.json().catch(() => null);
        const data = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
        if (cancelled) return;
        setBackendOnline(true);
        setStats({
          totalLeads: Number(data.totalLeads) || 0,
          leadsToday: Number(data.leadsToday) || 0,
          hotLeads:   Number(data.hotLeads)   || 0,
        });
        setHotLeadCount(Number(data.hotLeads) || 0);
      } catch (err) {
        if (cancelled) return;
        // AbortError isn't a real failure — it just means a newer poll started.
        if ((err as Error)?.name !== "AbortError") setBackendOnline(false);
      } finally {
        inFlightRef.current = false;
      }
    };

    refresh();
    const id = setInterval(refresh, 30_000);
    const onDataChanged = () => { refresh(); };
    window.addEventListener("leadstack:data-changed", onDataChanged);

    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
      window.removeEventListener("leadstack:data-changed", onDataChanged);
    };
  }, []);

  // Global keyboard shortcuts: ⌘K palette, ⌘1-5 nav.
  useEffect(() => {
    const isInEditable = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // ⌘K is a global escape hatch — fires from anywhere, including text fields.
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      // ⌘1–⌘5 navigation must NOT fire while the user is typing a campaign,
      // a search query, or a note — that would lose their input.
      if (meta && SHORTCUTS[e.key] && !isInEditable(e.target)) {
        e.preventDefault();
        setActiveSection(SHORTCUTS[e.key]);
      }
    };
    // Capture phase so the global shortcut intercepts before any nested
    // input handler can swallow the keystroke.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const ActiveComponent = SECTIONS[activeSection];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar
        active={activeSection}
        onChange={setActiveSection}
        replyCount={replyCount}
        hotLeadCount={hotLeadCount}
      />

      {showBriefing && <DailyBriefingModal onClose={() => setShowBriefing(false)} />}
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        onNavigate={(id) => setActiveSection(id)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          section={activeSection}
          notifications={replyCount + hotLeadCount}
          backendOnline={backendOnline}
          onBriefing={() => setShowBriefing(true)}
          onCommandPalette={() => setPalette(true)}
        />

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: "var(--bg-base)" }}
        >
          <Suspense fallback={<LoadingPane />}>
            <ActiveComponent />
          </Suspense>
        </main>

        <StatusBar
          totalLeads={stats?.totalLeads}
          newToday={stats?.leadsToday}
          backendOnline={backendOnline}
          onCommandPalette={() => setPalette(true)}
        />
      </div>
    </div>
  );
}
