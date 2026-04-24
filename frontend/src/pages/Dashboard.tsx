// LeadStack™ — Main Dashboard Page v2
import { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar, { SectionId } from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardSection from "@/components/sections/DashboardSection";
import ScraperSection from "@/components/sections/ScraperSection";
import EmailSection from "@/components/sections/EmailSection";
import CRMSection from "@/components/sections/CRMSection";
import ReplyMonitorSection from "@/components/sections/ReplyMonitorSection";
import SettingsSection from "@/components/sections/SettingsSection";
import AnalyticsSection from "@/components/sections/AnalyticsSection";
import SequencesSection from "@/components/sections/SequencesSection";
import WarmupSection from "@/components/sections/WarmupSection";
import DeliverabilitySection from "@/components/sections/DeliverabilitySection";
import DailyBriefingModal from "@/components/DailyBriefingModal";
import LinkedInSection from "@/components/sections/LinkedInSection";
import OnboardingWizard from "@/components/OnboardingWizard";

function LoadingPane() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "oklch(0.72 0.12 75)", borderTopColor: "transparent" }} />
        <span className="text-xs" style={{ color: "oklch(0.45 0.015 255)" }}>Loading...</span>
      </div>
    </div>
  );
}

const SECTIONS: Record<SectionId, React.ComponentType> = {
  dashboard: DashboardSection,
  scraper: ScraperSection,
  linkedin: LinkedInSection,
  email: EmailSection,
  followup: SequencesSection,
  replies: ReplyMonitorSection,
  crm: CRMSection,
  analytics: AnalyticsSection,
  warmup: WarmupSection,
  deliverability: DeliverabilitySection,
  settings: SettingsSection,
};

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [replyCount] = useState(2);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("leadstack_onboarding_complete")
  );

  const ActiveComponent = SECTIONS[activeSection];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.09 0.02 255)" }}>
      <Sidebar
        active={activeSection}
        onChange={(id) => setActiveSection(id)}
        replyCount={replyCount}
      />

      {showBriefing && <DailyBriefingModal onClose={() => setShowBriefing(false)} />}
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header section={activeSection} notifications={replyCount} onBriefing={() => setShowBriefing(true)} onNavigate={(id) => setActiveSection(id as SectionId)} />

        <main className="flex-1 overflow-y-auto" style={{ background: "oklch(0.09 0.02 255)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full"
            >
              <Suspense fallback={<LoadingPane />}>
                <ActiveComponent />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
