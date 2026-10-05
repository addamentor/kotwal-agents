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
    download: (id: string) => withBase(`/api/agents/${id}/download`),
    access: (id: string) => withBase(`/api/agents/${id}/access`),
    accessUser: (id: string, userId: string) => withBase(`/api/agents/${id}/access/${userId}`),
    knowledge: (id: string) => withBase(`/api/agents/${id}/knowledge`),
    knowledgeItem: (id: string, sourceId: string) => withBase(`/api/agents/${id}/knowledge/${sourceId}`),
    knowledgeReindex: (id: string, sourceId: string) => withBase(`/api/agents/${id}/knowledge/${sourceId}/reindex`),
    memory: (id: string) => withBase(`/api/agents/${id}/memory`),
    memoryItem: (id: string, key: string) => withBase(`/api/agents/${id}/memory/${encodeURIComponent(key)}`),
    publish: (id: string) => withBase(`/api/agents/${id}/publish`),
    runs: (id: string) => withBase(`/api/agents/${id}/runs`),
  },
  integrations: {
    base: withBase('/api/integrations'),
    provider: (provider: string) => withBase(`/api/integrations/${provider}`),
    files: (provider: string) => withBase(`/api/integrations/${provider}/files`),
    auth: (provider: string) => withBase(`/api/integrations/${provider}/auth`),
  },
  marketplace: {
    base: withBase('/api/marketplace'),
    install: (id: string) => withBase(`/api/marketplace/${id}/install`),
  },
  agentTeams: {
    base: withBase('/api/agent-teams'),
    team: (id: string) => withBase(`/api/agent-teams/${id}`),
  },
  mcp: {
    servers: withBase('/api/mcp/servers'),
  },
  chatModels: withBase('/api/chat-models'),
};

export type ApiUrlKey = keyof typeof API_URLS;
