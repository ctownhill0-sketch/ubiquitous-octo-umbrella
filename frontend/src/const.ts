// LeadStack — App Constants
export const COOKIE_NAME = "leadstack_session";
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// API base URL.
// Falls back to localhost:7432 for `npm run dev` against a locally-running
// Flask backend. In production set VITE_API_URL at build time (Vercel /
// Railway env vars) to point at the deployed backend, e.g.
//   VITE_API_URL=https://api.leadstack.example.com
//
// We strip any trailing slash so callers can safely do `${API_BASE}/api/...`.
const fromEnv = (import.meta.env.VITE_API_URL as string | undefined) || "";
export const API_BASE: string = (fromEnv || "http://localhost:7432").replace(/\/+$/, "");
