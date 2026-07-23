/**
 * Centralised API client.
 *
 *   - Adds the in-memory bearer token automatically.
 *   - Always sends `credentials: 'include'` so the refresh-token cookie travels.
 *   - On 401, transparently calls /api/auth/refresh once, then replays the request.
 *   - If the refresh fails, hands off to handleUnauthorized() (clears state, redirects).
 *
 * Concurrency: only one refresh request flies at a time; concurrent 401s wait on
 * the same in-flight refresh promise.
 */
import { API_URLS } from './url';
import { tokenStore } from './tokenStore';

let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(API_URLS.auth.refresh, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const body = (await res.json().catch(() => null)) as
        | { accessToken?: string; accessTokenTtl?: string }
        | null;
      if (!body?.accessToken) return false;
      // Best-effort TTL hint (string like "15m" → seconds; we leave hint empty otherwise).
      const ttlSeconds = parseTtlToSeconds(body.accessTokenTtl);
      tokenStore.set(body.accessToken, ttlSeconds);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function parseTtlToSeconds(ttl?: string): number | undefined {
  if (!ttl) return undefined;
  const m = /^(\d+)\s*(s|m|h|d)?$/i.exec(ttl.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : 1;
  return n * mult;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** When true, do NOT attempt refresh-on-401 (used by auth endpoints themselves). */
  skipAuth?: boolean;
  /** When true, do not auto-redirect on a final 401 — let the caller decide. */
  silentUnauthorized?: boolean;
}

export class ApiError<T = unknown> extends Error {
  status: number;
  body: T | undefined;
  constructor(message: string, status: number, body?: T) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

let onUnauthorized: (() => void) | null = null;

/** AuthContext registers a handler at startup so the client can react to a hard 401. */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function buildInit(options: ApiFetchOptions, token: string | null): RequestInit {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !options.skipAuth && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'string' || options.body instanceof FormData) {
      body = options.body as BodyInit;
    } else {
      body = JSON.stringify(options.body);
    }
  }

  return {
    ...options,
    headers,
    body,
    credentials: options.credentials ?? 'include',
  };
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  let token = tokenStore.get();
  let response = await fetch(url, buildInit(options, token));

  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await performRefresh();
    if (refreshed) {
      token = tokenStore.get();
      response = await fetch(url, buildInit(options, token));
    }

    if (response.status === 401) {
      tokenStore.clear();
      if (!options.silentUnauthorized && onUnauthorized) onUnauthorized();
    }
  }

  return response;
}

/** Convenience: parse JSON or throw ApiError with the body attached. */
export async function apiJson<T = unknown>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(url, options);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, body as T);
  }
  return body as T;
}
