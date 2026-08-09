/**
 * Agent API — user-facing "Agentverse". Backed by /api/agents/* (see kotwal
 * routes/agents.js). All requests share auth with the main app via apiClient.
 */
import { API_URLS } from '@/lib/url';
import { apiJson, apiFetch } from '@/lib/apiClient';

export type AnswerMode = 'strict' | 'hybrid' | 'open';
export type AgentScope = 'workspace' | 'user';
export type AgentStatus = 'active' | 'inactive';
export type AgentType = 'kotwal' | 'proxy';
export type ProxyAuthType = 'none' | 'bearer' | 'header';

export interface ToolConfig {
  fileAccess:    { enabled: boolean; allowedPaths: string[] };
  screenCapture: { enabled: boolean };
  shellExec:     { enabled: boolean; allowedCommands: string[] };
  webSearch:     boolean;
  mcpServerIds:  string[];
}

export function emptyToolConfig(): ToolConfig {
  return {
    fileAccess:    { enabled: false, allowedPaths: [] },
    screenCapture: { enabled: false },
    shellExec:     { enabled: false, allowedCommands: [] },
    webSearch:     false,
    mcpServerIds:  [],
  };
}

export interface Agent {
  id: string;
  tenantId: string;
  scope: AgentScope;
  workspaceId?: string | null;
  ownerUserId?: string | null;
  name: string;
  description?: string | null;
  instructions?: string | null;
  answerMode: AnswerMode;
  modelId?: string | null;
  toolConfig?: ToolConfig;
  shared: boolean;
  status: AgentStatus;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Proxy agent fields
  agentType?: AgentType;
  proxyUrl?: string | null;
  proxyAuthType?: ProxyAuthType;
  proxyAuthHeader?: string | null;
  hasProxySecret?: boolean;
  proxyRequestTemplate?: Record<string, unknown> | null;
  proxyResponsePath?: string | null;
}

export interface AgentInput {
  name: string;
  description?: string;
  instructions?: string;
  answerMode?: AnswerMode;
  modelId?: string | null;
  toolConfig?: ToolConfig;
  shared?: boolean;
  status?: AgentStatus;
  workspaceId?: string | null;
  // Proxy agent fields
  agentType?: AgentType;
  proxyUrl?: string | null;
  proxyAuthType?: ProxyAuthType;
  proxyAuthHeader?: string | null;
  proxyAuthSecret?: string | null;
  proxyRequestTemplate?: Record<string, unknown> | null;
  proxyResponsePath?: string | null;
}

export interface ChatModelOption {
  id: string;
  name: string;
  provider?: string | null;
}

// ── Own agents + shared catalog ─────────────────────────────────────────────
export const listOwnAgents = async (): Promise<Agent[]> => {
  const data = await apiJson<{ own: Agent[] }>(`${API_URLS.agents.base}?scope=own`, { method: 'GET' });
  return data.own ?? [];
};

export const listSharedAgents = async (search?: string): Promise<Agent[]> => {
  const qs = search && search.trim() ? `?scope=shared&search=${encodeURIComponent(search.trim())}` : '?scope=shared';
  const data = await apiJson<{ shared: Agent[] }>(`${API_URLS.agents.base}${qs}`, { method: 'GET' });
  return data.shared ?? [];
};

export const getAgent = async (id: string): Promise<Agent> => {
  const data = await apiJson<{ agent: Agent }>(API_URLS.agents.agent(id), { method: 'GET' });
  return data.agent;
};

export const createAgent = async (input: AgentInput): Promise<Agent> => {
  const data = await apiJson<{ agent: Agent }>(API_URLS.agents.base, { method: 'POST', body: input });
  return data.agent;
};

export const updateAgent = async (id: string, input: Partial<AgentInput>): Promise<Agent> => {
  const data = await apiJson<{ agent: Agent }>(API_URLS.agents.agent(id), { method: 'PATCH', body: input });
  return data.agent;
};

export const deleteAgent = async (id: string): Promise<void> => {
  await apiJson(API_URLS.agents.agent(id), { method: 'DELETE' });
};

/**
 * Download a signed agent bundle as a .kotwal-agent.json file.
 * The browser saves it to disk; the user loads it with the kotwal-agent CLI.
 */
export const downloadAgent = async (agent: Agent): Promise<void> => {
  const res = await apiFetch(API_URLS.agents.download(agent.id), { method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.error as string) || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = agent.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  a.download = `${safeName}.kotwal-agent.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

// ── Access grants (share with specific users) ───────────────────────────────
export const grantAccess = async (id: string, userId: string): Promise<void> => {
  await apiJson(API_URLS.agents.access(id), { method: 'POST', body: { userId } });
};

export const revokeAccess = async (id: string, userId: string): Promise<void> => {
  await apiJson(API_URLS.agents.accessUser(id, userId), { method: 'DELETE' });
};

// ── Chat models (for the optional pinned-model picker) ──────────────────────
export const listChatModels = async (): Promise<ChatModelOption[]> => {
  try {
    const data = await apiJson<{ models?: ChatModelOption[] }>(API_URLS.chatModels, { method: 'GET' });
    return data.models ?? [];
  } catch {
    return [];
  }
};
