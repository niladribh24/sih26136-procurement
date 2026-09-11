import { UserSession } from "./types";

export const DEMO_PERSONAS: UserSession[] = [
  {
    id: "user-govt-01",
    name: "Dr. A. Sharma",
    email: "sharma.icar@gov.in",
    role: "govt_officer",
    orgName: "Indian Council of Agricultural Research (ICAR)",
    department: "Division of Precision Agriculture & Drone Systems",
    token: "mock-jwt-gov-sharma-2026",
  },
  {
    id: "user-startup-01",
    name: "Vikram Mehta",
    email: "vikram@aerokisan.tech",
    role: "startup",
    orgName: "AeroKisan Technologies Pvt Ltd",
    dpiitNumber: "DIPP98234",
    token: "mock-jwt-startup-aerokisan-2026",
  },
  {
    id: "user-eval-01",
    name: "Prof. K. Rao",
    email: "krao@iitd.ac.in",
    role: "evaluator",
    orgName: "Indian Institute of Technology Delhi",
    department: "Aerospace & Autonomous Robotics",
    token: "mock-jwt-eval-rao-2026",
  },
];

const SESSION_COOKIE_KEY = "samarth_session_role";
const SESSION_DATA_KEY = "samarth_session_data";

let cachedSessionRaw: string | null = null;
let cachedSession: UserSession | null = null;

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_DATA_KEY);
    if (raw !== cachedSessionRaw) {
      cachedSessionRaw = raw;
      cachedSession = raw ? (JSON.parse(raw) as UserSession) : null;
    }
    return cachedSession;
  } catch {
    return null;
  }
}

export function subscribeSession(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("samarth_auth_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("samarth_auth_change", callback);
  };
}

export function setSession(session: UserSession) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  cachedSessionRaw = raw;
  cachedSession = session;
  localStorage.setItem(SESSION_DATA_KEY, raw);
  // Set cookie for Next.js Edge middleware checking
  document.cookie = `${SESSION_COOKIE_KEY}=${session.role}; path=/; max-age=86400; SameSite=Lax`;
  window.dispatchEvent(new Event("samarth_auth_change"));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  cachedSessionRaw = null;
  cachedSession = null;
  localStorage.removeItem(SESSION_DATA_KEY);
  document.cookie = `${SESSION_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  window.dispatchEvent(new Event("samarth_auth_change"));
}
