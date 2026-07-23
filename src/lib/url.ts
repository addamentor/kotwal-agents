/**
 * API URL registry for the Kotwal Agents app. Override base via VITE_API_BASE_URL.
 * Points at the SAME API as kotwaluiapp so the httpOnly refresh cookie is shared
 * and login carries over between the two apps.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://api.aikotwal.com';

const withBase = (path: string) => `${BASE_URL}${path}`;

export const API_BASE_URL = BASE_URL;

export const API_URLS = {
  auth: {
    login: withBase('/api/auth/login'),
    refresh: withBase('/api/auth/refresh'),
    logout: withBase('/api/auth/logout'),
    me: withBase('/api/auth/me'),
  },
  agents: {
    base: withBase('/api/agents'),
    available: withBase('/api/agents/available'),
    agent: (id: string) => withBase(`/api/agents/${id}`),
    access: (id: string) => withBase(`/api/agents/${id}/access`),
    accessUser: (id: string, userId: string) => withBase(`/api/agents/${id}/access/${userId}`),
  },
  chatModels: withBase('/api/chat-models'),
};

export type ApiUrlKey = keyof typeof API_URLS;
