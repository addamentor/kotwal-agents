import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { API_URLS } from '@/lib/url';
import { apiFetch, apiJson, ApiError, setUnauthorizedHandler } from '@/lib/apiClient';
import { tokenStore } from '@/lib/tokenStore';
import { cacheUser, clearCachedUser, loadCachedUser, CachedUser } from '@/lib/authStorage';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

interface AuthUser {
  email: string;
  role?: string;
  name?: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  /** Plain access token for legacy services that haven't been migrated to apiFetch yet. */
  token: string | null;
  hasRole: (...roles: string[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface LoginResponse {
  accessToken: string;
  accessTokenTtl?: string;
  user?: { email: string; name?: string; role?: string };
}

interface MeResponse {
  role?: string;
  permissions?: string[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseTtlSeconds = (ttl?: string): number | undefined => {
  if (!ttl) return undefined;
  const m = /^(\d+)\s*(s|m|h|d)?$/i.exec(ttl.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : 1;
  return n * mult;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const initialUser = loadCachedUser();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapRan = useRef(false);

  // Mirror tokenStore -> React state so consumers re-render.
  useEffect(() => {
    setToken(tokenStore.get());
    return tokenStore.subscribe((t) => setToken(t));
  }, []);

  // Hard-401 handler: clear and bounce to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      clearCachedUser();
      setUser(null);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    });
  }, []);

  const hydrateMe = useCallback(async (fallback?: CachedUser) => {
    try {
      const me = await apiJson<MeResponse>(API_URLS.auth.me, { method: 'GET' });
      const merged: AuthUser = {
        email: fallback?.email || '',
        name: fallback?.name,
        role: me?.role || fallback?.role,
      };
      setUser(merged);
      cacheUser(merged);
      return merged;
    } catch {
      return null;
    }
  }, []);

  // Bootstrap on first mount: try /api/auth/refresh (uses httpOnly cookie).
  useEffect(() => {
    if (bootstrapRan.current) return;
    bootstrapRan.current = true;

    (async () => {
      try {
        const res = await fetch(API_URLS.auth.refresh, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const body = (await res.json()) as { accessToken: string; accessTokenTtl?: string };
          tokenStore.set(body.accessToken, parseTtlSeconds(body.accessTokenTtl));
          await hydrateMe(initialUser ?? undefined);
        } else {
          // No refresh cookie / expired family — definitely logged out.
          clearCachedUser();
          setUser(null);
        }
      } catch {
        clearCachedUser();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }

      try {
        const data = await apiJson<LoginResponse>(API_URLS.auth.login, {
          method: 'POST',
          body: { email, password },
          skipAuth: true,
        });

        if (!data.accessToken) {
          throw new Error('Login API did not return a token.');
        }

        tokenStore.set(data.accessToken, parseTtlSeconds(data.accessTokenTtl));
        const merged: AuthUser = {
          email: data.user?.email || email,
          name: data.user?.name,
          role: data.user?.role,
        };
        setUser(merged);
        cacheUser(merged);

        // Best-effort role/perm refresh in case server cached stale role on token.
        void hydrateMe(merged);
      } catch (error) {
        const description =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Unable to login. Please try again.';
        showErrorToast('Login failed', description);
        throw error instanceof Error ? error : new Error(description);
      }
    },
    [hydrateMe],
  );

  const logout = useCallback(async () => {
    try {
      // Server revokes the family + clears the cookie.
      await apiFetch(API_URLS.auth.logout, { method: 'POST', skipAuth: true, silentUnauthorized: true });
    } catch {
      /* network errors during logout are non-fatal */
    }
    tokenStore.clear();
    clearCachedUser();
    setUser(null);
    showSuccessToast('Logged out', 'You have been signed out of Kotwal.');
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user?.role) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!token,
      user,
      loading,
      token,
      hasRole,
      login,
      logout,
    }),
    [token, user, loading, hasRole, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
