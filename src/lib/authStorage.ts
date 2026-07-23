/**
 * Lightweight client-side cache for *non-sensitive* user info (email, role).
 *
 * Tokens are NEVER stored here. Auth tokens live only in memory (tokenStore.ts);
 * the refresh token is in an httpOnly cookie set by the server.
 *
 * The cached user info is purely a UX optimisation so the navbar doesn't flash
 * empty between page reload and the bootstrap /refresh call completing. It
 * is not a source of truth and is overwritten on every successful login or
 * /me fetch.
 */
const STORAGE_KEY = 'kotwal_user';

export interface CachedUser {
  email: string;
  role?: string;
  name?: string;
}

const hasStorage = () => typeof window !== 'undefined' && !!window.sessionStorage;

export const loadCachedUser = (): CachedUser | null => {
  if (!hasStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedUser) : null;
  } catch {
    return null;
  }
};

export const cacheUser = (user: CachedUser | null) => {
  if (!hasStorage()) return;
  try {
    if (!user) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
};

export const clearCachedUser = () => cacheUser(null);

// --- Back-compat exports kept so adminApi/billingApi keep building ---
export { getStoredToken } from './tokenStore';
export const AUTH_STORAGE_KEY = STORAGE_KEY;
export const clearAuthState = clearCachedUser;
