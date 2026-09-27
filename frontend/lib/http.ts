"use client";

import { API_URL } from "./config";
import { clearSession, getSession } from "./auth";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Status 0 = the request never got a response (backend down, CORS, DNS). */
export const NETWORK_ERROR_STATUS = 0;

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
  /** false for login/signup: no Bearer header, and a 401 is a normal error, not "session expired". */
  auth?: boolean;
}

// FastAPI returns { detail: "msg" } or, for validation errors, { detail: [{ loc, msg }, ...] }.
function readDetail(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        const msg = (d.msg || "").replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  return fallback;
}

function redirectToLogin() {
  clearSession();
  const here = window.location.pathname + window.location.search;
  const params = new URLSearchParams({ error: "session_expired" });
  if (!here.startsWith("/login")) params.set("redirect", here);
  // apiFetch runs outside React (no router), and a full load also drops the dead session's in-memory state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?${params.toString()}`);
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", json, form, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getSession()?.token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, `Backend unreachable at ${API_URL}.`);
  }

  if (res.status === 401 && auth) {
    redirectToLogin();
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, readDetail(body, `Request failed (${res.status}).`));
  }
  return body as T;
}

/** Returns null on 404 instead of throwing — matches the mock's `find(...) || null` getters. */
export async function apiFetchOrNull<T>(path: string, opts?: FetchOptions): Promise<T | null> {
  try {
    return await apiFetch<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** One-line user-facing message for any thrown error. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please retry."): string {
  if (err instanceof ApiError) return err.detail;
  return fallback;
}
