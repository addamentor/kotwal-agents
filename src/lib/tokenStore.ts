/**
 * In-memory access-token store.
 *
 *   - The access JWT lives ONLY in memory; never localStorage / sessionStorage.
 *     This kills the entire class of XSS-token-exfil attacks.
 *   - The refresh token lives in an httpOnly cookie set by the server
 *     (path=/api/auth, SameSite=Strict).
 *   - On a page reload the in-memory token is gone, so the AuthProvider
 *     bootstraps by calling /api/auth/refresh; the cookie reauthenticates
 *     the user and a new access token is minted.
 */
type Listener = (token: string | null) => void;

let accessToken: string | null = null;
let expiresAt: number | null = null;
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((l) => l(accessToken));

export const tokenStore = {
  get: (): string | null => accessToken,

  set: (token: string | null, ttlSecondsHint?: number) => {
    accessToken = token;
    expiresAt = token && ttlSecondsHint ? Date.now() + ttlSecondsHint * 1000 : null;
    notify();
  },

  clear: () => {
    accessToken = null;
    expiresAt = null;
    notify();
  },

  isExpiringSoon: (skewMs = 30_000): boolean => {
    if (!expiresAt) return false;
    return Date.now() + skewMs >= expiresAt;
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** Back-compat shim — existing services call this. */
export const getStoredToken = (): string | null => accessToken;
