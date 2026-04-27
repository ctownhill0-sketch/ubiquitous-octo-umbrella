// LeadStack™ — API Client
// All calls go to the local Python Flask backend at localhost:7432

const BASE = "http://localhost:7432/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Stats ─────────────────────────────────────────────────────────────────
export interface Stats {
  totalLeads: number;
  leadsToday: number;
  withEmail: number;
  withPhone: number;
  emailsSent: number;
  emailsToday: number;
  openRate: number;
  replyRate: number;
  hotLeads: number;
  meetingsBooked: number;
  pipelineValue: number;
  projectedRevenue: number;
}

export function getStats(): Promise<Stats> {
  return request<Stats>("/stats");
}

// ── Leads ─────────────────────────────────────────────────────────────────
export interface Lead {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  category?: string;
  maps_url?: string;
  score: number;
  status: string;
  notes?: string;
  created_at?: string;
  last_contacted?: string;
  email_step?: number;
}

export function getLeads(params?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<{ leads: Lead[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return request<{ leads: Lead[]; total: number }>(`/leads?${qs}`);
}

export function updateLead(id: number, data: Partial<Lead>): Promise<Lead> {
  return request<Lead>(`/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteLead(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/leads/${id}`, { method: "DELETE" });
}

export function exportLeadsCSV(): void {
  window.open(`${BASE}/leads/export`, "_blank");
}

// ── Scraper ───────────────────────────────────────────────────────────────
export interface ScrapeJob {
  id: string;
  keyword: string;
  cities: string[];
  status: "pending" | "running" | "completed" | "failed";
  leadsFound: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export function startScrape(payload: { keyword: string; cities: string[]; maxPerCity?: number }): Promise<ScrapeJob> {
  return request<ScrapeJob>("/scrape/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getScrapeStatus(): Promise<ScrapeJob | null> {
  return request<ScrapeJob | null>("/scrape/status");
}

export function stopScrape(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/scrape/stop", { method: "POST" });
}

// ── Email ─────────────────────────────────────────────────────────────────
export interface EmailJob {
  id: string;
  status: "idle" | "running" | "done" | "error";
  sent: number;
  failed: number;
  startedAt?: string;
  completedAt?: string;
}

export function sendEmails(payload: { leadIds?: number[]; all?: boolean; step?: number }): Promise<EmailJob> {
  return request<EmailJob>("/email/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getEmailStatus(): Promise<EmailJob> {
  return request<EmailJob>("/email/status");
}

// ── Reply Monitor ─────────────────────────────────────────────────────────
export interface Reply {
  id: number;
  leadId: number;
  leadName: string;
  company: string;
  email: string;
  subject: string;
  preview: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  receivedAt: string;
  isHot: boolean;
  isRead: boolean;
  category: string;
  step: number;
}

export function getReplies(): Promise<Reply[]> {
  return request<Reply[]>("/replies");
}

export function markReplyRead(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/replies/${id}/read`, { method: "POST" });
}

export function checkReplies(): Promise<{ checked: number; newReplies: number }> {
  return request<{ checked: number; newReplies: number }>("/replies/check", { method: "POST" });
}

// ── Daily Report ──────────────────────────────────────────────────────────
export interface DailyReport {
  date: string;
  newLeads: number;
  emailsSent: number;
  emailsOpened: number;
  repliesReceived: number;
  hotLeads: number;
  openRate: number;
  replyRate: number;
  weeklyData: Array<{ day: string; leads: number; emails: number; replies: number }>;
  topCities: Array<{ city: string; leads: number; emails: number; replies: number }>;
  summary: string;
}

export function getDailyReport(): Promise<DailyReport> {
  return request<DailyReport>("/report/daily");
}

export function generateReport(): Promise<DailyReport> {
  return request<DailyReport>("/report/generate", { method: "POST" });
}

// ── Settings ──────────────────────────────────────────────────────────────
export interface Settings {
  anthropicKey?: string;
  gmailCredentials?: string;
  gmailToken?: string;
  senderEmail?: string;
  senderName?: string;
  appPassword?: string;
  followUpDays: number[];
  maxEmailsPerDay: number;
  scrapeDelay: number;
  targetKeyword: string;
  productName: string;
  productUrl: string;
  calendlyUrl?: string;
  senderSignature?: string;
  googleMapsApiKey?: string;
  // Allow forward-compatible read of fields the backend adds without
  // requiring a type bump (anthropicApiKey, etc.).
  [key: string]: unknown;
}

export function getSettings(): Promise<Settings> {
  return request<Settings>("/settings");
}

export function saveSettings(data: Partial<Settings>): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/settings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Health ────────────────────────────────────────────────────────────────
export function healthCheck(): Promise<{ status: string; version: string }> {
  return request<{ status: string; version: string }>("/health");
}
