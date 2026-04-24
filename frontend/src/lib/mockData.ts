// ============================================================
// LeadStack™ Mock Data Store
// Simulates live data from all 5 engines
// ============================================================

export type LeadStatus = "New" | "Called" | "Hot Lead" | "Meeting Booked" | "Not Interested" | "Unsubscribed";
export type LeadScore = "Hot" | "Warm" | "Cold";
export type SentimentType = "Positive" | "Neutral" | "Negative";

export interface Lead {
  id: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  state: string;
  category: string;
  rating: number;
  reviews: number;
  score: number;
  scoreLabel: LeadScore;
  status: LeadStatus;
  lastContacted: string | null;
  nextAction: string;
  emailStep: number;
  source: string;
  linkedIn: string;
  address: string;
  scraped_at: string;
}

export interface EmailEvent {
  id: number;
  leadName: string;
  company: string;
  email: string;
  subject: string;
  step: number;
  sentAt: string;
  opened: boolean;
  replied: boolean;
  status: "sent" | "opened" | "replied" | "bounced";
}

export interface Reply {
  id: number;
  leadName: string;
  company: string;
  email: string;
  subject: string;
  preview: string;
  sentiment: SentimentType;
  receivedAt: string;
  isHot: boolean;
  read: boolean;
  isRead: boolean;
  category: string;
  step: number;
}

export interface ScraperJob {
  id: number;
  keyword: string;
  city: string;
  state: string;
  status: "pending" | "running" | "completed" | "failed";
  leadsFound: number;
  startedAt: string;
  completedAt: string | null;
}

// ── Leads ─────────────────────────────────────────────────────────────────
export const MOCK_LEADS: Lead[] = [
  { id: 1, name: "James Whitfield", company: "Whitfield Capital Advisors", phone: "(212) 555-0142", email: "james@whitfieldcapital.com", website: "whitfieldcapital.com", city: "New York", state: "NY", category: "Financial Advisor", rating: 4.8, reviews: 47, score: 95, scoreLabel: "Hot", status: "Hot Lead", lastContacted: "2026-04-10", nextAction: "Call today", emailStep: 2, source: "Google Maps", linkedIn: "linkedin.com/in/jwhitfield", address: "350 Park Ave, New York, NY 10022", scraped_at: "2026-04-11" },
  { id: 2, name: "Sarah Chen", company: "Pinnacle Wealth Management", phone: "(415) 555-0287", email: "s.chen@pinnaclewealth.com", website: "pinnaclewealth.com", city: "San Francisco", state: "CA", category: "Wealth Manager", rating: 4.9, reviews: 83, score: 98, scoreLabel: "Hot", status: "Meeting Booked", lastContacted: "2026-04-09", nextAction: "Meeting Apr 14", emailStep: 3, source: "Google Maps", linkedIn: "linkedin.com/in/sarahchen", address: "101 California St, SF, CA 94111", scraped_at: "2026-04-10" },
  { id: 3, name: "Robert Martinez", company: "Martinez Financial Group", phone: "(312) 555-0391", email: "rmartinez@martinezfg.com", website: "martinezfg.com", city: "Chicago", state: "IL", category: "Financial Planner", rating: 4.6, reviews: 31, score: 82, scoreLabel: "Hot", status: "Called", lastContacted: "2026-04-08", nextAction: "Follow-up email", emailStep: 2, source: "Google Maps", linkedIn: "", address: "233 S Wacker Dr, Chicago, IL 60606", scraped_at: "2026-04-09" },
  { id: 4, name: "Emily Thompson", company: "Thompson & Associates RIA", phone: "(713) 555-0456", email: "emily@thompsonria.com", website: "thompsonria.com", city: "Houston", state: "TX", category: "RIA", rating: 4.7, reviews: 22, score: 88, scoreLabel: "Hot", status: "New", lastContacted: null, nextAction: "Send intro email", emailStep: 0, source: "Google Maps", linkedIn: "linkedin.com/in/emilythompson", address: "1000 Main St, Houston, TX 77002", scraped_at: "2026-04-11" },
  { id: 5, name: "David Park", company: "Park Wealth Strategies", phone: "(602) 555-0512", email: "dpark@parkwealth.com", website: "parkwealth.com", city: "Phoenix", state: "AZ", category: "Financial Advisor", rating: 4.5, reviews: 18, score: 75, scoreLabel: "Warm", status: "New", lastContacted: null, nextAction: "Send intro email", emailStep: 0, source: "Google Maps", linkedIn: "", address: "2 N Central Ave, Phoenix, AZ 85004", scraped_at: "2026-04-11" },
  { id: 6, name: "Lisa Johnson", company: "Johnson Retirement Planning", phone: "(215) 555-0634", email: "lisa@johnsonretire.com", website: "johnsonretire.com", city: "Philadelphia", state: "PA", category: "Retirement Planner", rating: 4.4, reviews: 29, score: 71, scoreLabel: "Warm", status: "Called", lastContacted: "2026-04-07", nextAction: "Day 7 follow-up", emailStep: 2, source: "Google Maps", linkedIn: "linkedin.com/in/lisajohnson", address: "1650 Market St, Philadelphia, PA 19103", scraped_at: "2026-04-08" },
  { id: 7, name: "Michael Brown", company: "Brown Capital Partners", phone: "(210) 555-0778", email: "mbrown@browncapital.com", website: "browncapital.com", city: "San Antonio", state: "TX", category: "Investment Advisor", rating: 4.3, reviews: 14, score: 68, scoreLabel: "Warm", status: "New", lastContacted: null, nextAction: "Send intro email", emailStep: 0, source: "Google Maps", linkedIn: "", address: "300 Convent St, San Antonio, TX 78205", scraped_at: "2026-04-11" },
  { id: 8, name: "Jennifer Davis", company: "Davis Fiduciary Advisors", phone: "(619) 555-0891", email: "jdavis@davisfiduciary.com", website: "davisfiduciary.com", city: "San Diego", state: "CA", category: "Fiduciary Advisor", rating: 4.8, reviews: 56, score: 91, scoreLabel: "Hot", status: "Hot Lead", lastContacted: "2026-04-10", nextAction: "Call today", emailStep: 2, source: "Google Maps", linkedIn: "linkedin.com/in/jenniferdavis", address: "600 B St, San Diego, CA 92101", scraped_at: "2026-04-09" },
  { id: 9, name: "Christopher Wilson", company: "Wilson Wealth Group", phone: "(214) 555-0923", email: "", website: "wilsonwealth.com", city: "Dallas", state: "TX", category: "Wealth Manager", rating: 4.2, reviews: 11, score: 52, scoreLabel: "Cold", status: "New", lastContacted: null, nextAction: "Find email", emailStep: 0, source: "Google Maps", linkedIn: "", address: "2200 Ross Ave, Dallas, TX 75201", scraped_at: "2026-04-11" },
  { id: 10, name: "Amanda Garcia", company: "Garcia Financial Solutions", phone: "(408) 555-1047", email: "amanda@garciafinancial.com", website: "garciafinancial.com", city: "San Jose", state: "CA", category: "Financial Planner", rating: 4.6, reviews: 38, score: 84, scoreLabel: "Hot", status: "New", lastContacted: null, nextAction: "Send intro email", emailStep: 0, source: "Google Maps", linkedIn: "linkedin.com/in/amandagarcia", address: "200 E Santa Clara St, San Jose, CA 95113", scraped_at: "2026-04-11" },
  { id: 11, name: "Kevin Lee", company: "Lee Investment Management", phone: "(512) 555-1156", email: "klee@leeinvestment.com", website: "leeinvestment.com", city: "Austin", state: "TX", category: "Investment Manager", rating: 4.7, reviews: 44, score: 87, scoreLabel: "Hot", status: "Called", lastContacted: "2026-04-09", nextAction: "Day 3 follow-up", emailStep: 1, source: "Google Maps", linkedIn: "linkedin.com/in/kevinlee", address: "301 Congress Ave, Austin, TX 78701", scraped_at: "2026-04-08" },
  { id: 12, name: "Patricia Moore", company: "Moore Retirement Advisors", phone: "(904) 555-1267", email: "pmoore@mooreretire.com", website: "mooreretire.com", city: "Jacksonville", state: "FL", category: "Retirement Advisor", rating: 4.1, reviews: 9, score: 58, scoreLabel: "Cold", status: "Not Interested", lastContacted: "2026-04-06", nextAction: "Archive", emailStep: 3, source: "Google Maps", linkedIn: "", address: "1 Independent Dr, Jacksonville, FL 32202", scraped_at: "2026-04-05" },
];

// ── Email Events ──────────────────────────────────────────────────────────
export const MOCK_EMAIL_EVENTS: EmailEvent[] = [
  { id: 1, leadName: "James Whitfield", company: "Whitfield Capital", email: "james@whitfieldcapital.com", subject: "Quick question about your follow-up process", step: 1, sentAt: "2026-04-11 08:14:22", opened: true, replied: false, status: "opened" },
  { id: 2, leadName: "Sarah Chen", company: "Pinnacle Wealth", email: "s.chen@pinnaclewealth.com", subject: "Re: LeadStack — saw your firm online", step: 2, sentAt: "2026-04-11 08:15:07", opened: true, replied: true, status: "replied" },
  { id: 3, leadName: "Emily Thompson", company: "Thompson & Associates", email: "emily@thompsonria.com", subject: "LeadStack — automated follow-ups for RIAs", step: 1, sentAt: "2026-04-11 08:16:33", opened: false, replied: false, status: "sent" },
  { id: 4, leadName: "Jennifer Davis", company: "Davis Fiduciary", email: "jdavis@davisfiduciary.com", subject: "Quick question about your follow-up process", step: 1, sentAt: "2026-04-11 08:17:45", opened: true, replied: false, status: "opened" },
  { id: 5, leadName: "Amanda Garcia", company: "Garcia Financial", email: "amanda@garciafinancial.com", subject: "LeadStack — automated follow-ups for RIAs", step: 1, sentAt: "2026-04-11 08:18:12", opened: false, replied: false, status: "sent" },
  { id: 6, leadName: "Kevin Lee", company: "Lee Investment Mgmt", email: "klee@leeinvestment.com", subject: "Last note from LeadStack", step: 3, sentAt: "2026-04-11 08:19:04", opened: true, replied: false, status: "opened" },
];

// ── Replies ───────────────────────────────────────────────────────────────
export const MOCK_REPLIES: Reply[] = [
  { id: 1, leadName: "Sarah Chen", company: "Pinnacle Wealth Management", email: "s.chen@pinnaclewealth.com", subject: "Re: LeadStack — saw your firm online", preview: "Hi, this looks really interesting. We've been struggling with exactly this problem — losing warm leads because we don't have a system. Can we schedule a quick call?", sentiment: "Positive", receivedAt: "2026-04-11 09:23:11", isHot: true, read: false, isRead: false, category: "Interested", step: 1 },
  { id: 2, leadName: "Robert Martinez", company: "Martinez Financial Group", email: "rmartinez@martinezfg.com", subject: "Re: Quick question about your follow-up process", preview: "Thanks for reaching out. I'm a bit busy this month but maybe next quarter would work better. Feel free to follow up then.", sentiment: "Neutral", receivedAt: "2026-04-10 14:45:33", isHot: false, read: true, isRead: true, category: "Question", step: 2 },
  { id: 3, leadName: "Patricia Moore", company: "Moore Retirement Advisors", email: "pmoore@mooreretire.com", subject: "Re: LeadStack — automated follow-ups for RIAs", preview: "Please remove me from your list. I'm not interested in this type of service.", sentiment: "Negative", receivedAt: "2026-04-10 11:12:07", isHot: false, read: true, isRead: true, category: "Not Interested", step: 1 },
  { id: 4, leadName: "Kevin Lee", company: "Lee Investment Management", email: "klee@leeinvestment.com", subject: "Re: Last note from LeadStack", preview: "Actually I've been thinking about this. We lose probably 3-4 prospects a month just from lack of follow-up. What does pricing look like?", sentiment: "Positive", receivedAt: "2026-04-11 10:05:44", isHot: true, read: false, isRead: false, category: "Interested", step: 3 },
  { id: 5, leadName: "Angela Foster", company: "Foster Wealth Advisors", email: "afoster@fosterwealth.com", subject: "Re: Quick question about your follow-up process", preview: "This is exactly what we need. We have about 200 leads in our CRM that have gone cold. Can LeadStack re-engage them automatically?", sentiment: "Positive", receivedAt: "2026-04-11 08:14:22", isHot: true, read: false, isRead: false, category: "Interested", step: 1 },
  { id: 6, leadName: "Marcus Webb", company: "Webb Capital Group", email: "mwebb@webbcapital.com", subject: "Re: LeadStack — automated follow-ups for RIAs", preview: "Interesting. Do you integrate with Redtail or Wealthbox? That would be the deciding factor for us.", sentiment: "Neutral", receivedAt: "2026-04-10 16:30:09", isHot: false, read: true, isRead: true, category: "Question", step: 2 },
];

// ── Scraper Jobs ──────────────────────────────────────────────────────────
export const MOCK_SCRAPER_JOBS: ScraperJob[] = [
  { id: 1, keyword: "independent financial advisor", city: "New York", state: "NY", status: "completed", leadsFound: 23, startedAt: "2026-04-11 02:00:12", completedAt: "2026-04-11 02:18:44" },
  { id: 2, keyword: "independent financial advisor", city: "Los Angeles", state: "CA", status: "completed", leadsFound: 19, startedAt: "2026-04-11 02:19:01", completedAt: "2026-04-11 02:35:22" },
  { id: 3, keyword: "independent financial advisor", city: "Chicago", state: "IL", status: "completed", leadsFound: 17, startedAt: "2026-04-11 02:35:40", completedAt: "2026-04-11 02:51:09" },
  { id: 4, keyword: "independent financial advisor", city: "Houston", state: "TX", status: "running", leadsFound: 8, startedAt: "2026-04-11 02:51:30", completedAt: null },
  { id: 5, keyword: "independent financial advisor", city: "Phoenix", state: "AZ", status: "pending", leadsFound: 0, startedAt: "", completedAt: null },
  { id: 6, keyword: "independent financial advisor", city: "Philadelphia", state: "PA", status: "pending", leadsFound: 0, startedAt: "", completedAt: null },
];

// ── Chart Data ────────────────────────────────────────────────────────────
export const WEEKLY_STATS = [
  { day: "Mon", leads: 34, emails: 28, replies: 3 },
  { day: "Tue", leads: 41, emails: 35, replies: 5 },
  { day: "Wed", leads: 28, emails: 22, replies: 2 },
  { day: "Thu", leads: 52, emails: 44, replies: 7 },
  { day: "Fri", leads: 47, emails: 40, replies: 6 },
  { day: "Sat", leads: 19, emails: 15, replies: 1 },
  { day: "Sun", leads: 23, emails: 18, replies: 2 },
];

export const WEEKLY_LEADS_DATA = [
  { day: "Mon", leads: 34, emails: 28, replies: 3 },
  { day: "Tue", leads: 41, emails: 35, replies: 5 },
  { day: "Wed", leads: 28, emails: 22, replies: 2 },
  { day: "Thu", leads: 52, emails: 44, replies: 7 },
  { day: "Fri", leads: 47, emails: 40, replies: 6 },
  { day: "Sat", leads: 19, emails: 15, replies: 1 },
  { day: "Sun", leads: 23, emails: 18, replies: 2 },
];

export const HOURLY_EMAIL_DATA = [
  { hour: "8am", sent: 12 }, { hour: "9am", sent: 8 }, { hour: "10am", sent: 5 },
  { hour: "11am", sent: 3 }, { hour: "12pm", sent: 2 }, { hour: "1pm", sent: 4 },
  { hour: "2pm", sent: 6 }, { hour: "3pm", sent: 4 }, { hour: "4pm", sent: 3 },
];

export const EMAIL_SEQUENCE_DATA = [
  { name: "Email 1", sent: 244, opened: 89, replied: 18, openRate: 36.5, replyRate: 7.4 },
  { name: "Email 2", sent: 156, opened: 52, replied: 12, openRate: 33.3, replyRate: 7.7 },
  { name: "Email 3", sent: 98, opened: 28, replied: 8, openRate: 28.6, replyRate: 8.2 },
];

export const CITY_PERFORMANCE = [
  { city: "New York, NY", leads: 89, emails: 67, replies: 9, meetings: 2 },
  { city: "Los Angeles, CA", leads: 74, emails: 58, replies: 7, meetings: 1 },
  { city: "Chicago, IL", leads: 61, emails: 49, replies: 6, meetings: 2 },
  { city: "Houston, TX", leads: 52, emails: 41, replies: 5, meetings: 1 },
  { city: "Phoenix, AZ", leads: 38, emails: 29, replies: 3, meetings: 0 },
];

export const STATS = {
  totalLeads: 412,
  leadsToday: 67,
  withEmail: 287,
  withPhone: 334,
  emailsSent: 244,
  emailsToday: 38,
  openRate: 34.8,
  replyRate: 7.4,
  hotLeads: 14,
  meetingsBooked: 6,
  pipelineValue: 47400,
  projectedRevenue: 8200,
};
