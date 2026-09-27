import { UserSession } from "./types";
import { USE_MOCK_API } from "./config";

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

// Accounts created by backend/seed.py (`python seed.py`). Used by the 1-click persona
// buttons when talking to the real backend: they log in for real with DEMO_PASSWORD, so
// token/id here are placeholders — the session comes from POST /api/auth/login.
export const DEMO_PASSWORD = "Samarth@2026";

export const SEED_PERSONAS: UserSession[] = [
  {
    id: "seed-officer-agri",
    name: "Dr. Anjali Mehra",
    email: "officer.agri@samarth.demo",
    role: "govt_officer",
    orgName: "Ministry of Agriculture & Farmers Welfare",
    department: "Department of Agriculture & Farmers Welfare",
    token: "",
  },
  {
    id: "seed-startup-krishinetra",
    name: "Aditya Kulkarni",
    email: "krishinetra@samarth.demo",
    role: "startup",
    orgName: "KrishiNetra Vision Pvt Ltd",
    dpiitNumber: "DIPP41872",
    token: "",
  },
  {
    id: "seed-evaluator",
    name: "Prof. Meera Iyer",
    email: "evaluator@samarth.demo",
    role: "evaluator",
    orgName: "Independent Technical Evaluation Panel",
    department: "Technology Assessment Cell",
    token: "",
  },
];

/** The personas the 1-click buttons offer in the current API mode. */
export const ACTIVE_PERSONAS: UserSession[] = USE_MOCK_API ? DEMO_PERSONAS : SEED_PERSONAS;

/** Persona ids aren't real user ids in backend mode, so compare by email. */
export function isSamePersona(session: UserSession | null, persona: UserSession): boolean {
  return Boolean(session && session.email.toLowerCase() === persona.email.toLowerCase());
}

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
