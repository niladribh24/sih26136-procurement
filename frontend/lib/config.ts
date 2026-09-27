// Build-time settings. Next inlines NEXT_PUBLIC_* at build/dev-server start,
// so restart `npm run dev` after changing them.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

// "true" → the localStorage mock in lib/api.ts; anything else → the real backend.
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
