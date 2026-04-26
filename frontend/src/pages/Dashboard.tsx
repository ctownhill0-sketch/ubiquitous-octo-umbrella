// LeadStack — Main Dashboard Page (Precision Dark shell)
import { useEffect, useState, Suspense, lazy } from "react";
import Sidebar, { SectionId } from "@/components/Sidebar";
import Header from "@/components/Header";
import StatusBar from "@/components/StatusBar";
import CommandPalette from "@/components/CommandPalette";
import DailyBriefingModal from "@/components/DailyBriefingModal";
import OnboardingWizard from "@/components/OnboardingWizard";

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
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("http://localhost:7432/api/stats");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setBackendOnline(true);
        setStats({
          totalLeads: data.totalLeads ?? 0,
          leadsToday: data.leadsToday ?? 0,
          hotLeads: data.hotLeads ?? 0,
        });
        setHotLeadCount(data.hotLeads ?? 0);
      } catch {
        if (!cancelled) setBackendOnline(false);
      }
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Global keyboard shortcuts: ⌘K palette, ⌘1-5 nav.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (meta && SHORTCUTS[e.key]) {
        e.preventDefault();
        setActiveSection(SHORTCUTS[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
