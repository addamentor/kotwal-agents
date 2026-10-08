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
  /** Proxy agents only: enforce grounding + answer mode before forwarding. */
  groundProxy?:  boolean;
}

export function emptyToolConfig(): ToolConfig {
  return {
    fileAccess:    { enabled: false, allowedPaths: [] },
    screenCapture: { enabled: false },
    shellExec:     { enabled: false, allowedCommands: [] },
    webSearch:     false,
    mcpServerIds:  [],
    groundProxy:   false,
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
  // Marketplace fields (AG16)
  publishStatus?: 'pending' | 'approved' | 'rejected' | null;
  publishRejectReason?: string | null;
  version?: number;
  marketplaceTags?: string[];
  sourceAgentId?: string | null;
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
  /** Per-model capability flags resolved by the backend (/api/chat-models). */
  capabilities?: {
    vision?: boolean;
    thinking?: boolean;
    reasoning?: boolean;
    tools?: boolean;
    imageGen?: boolean;
  } | null;
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
 * Pass includeKnowledge: true to embed encrypted knowledge chunks in the bundle.
 */
export const downloadAgent = async (agent: Agent, opts: { includeKnowledge?: boolean } = {}): Promise<void> => {
  const qs = opts.includeKnowledge ? '?includeKnowledge=true' : '';
  const res = await apiFetch(`${API_URLS.agents.download(agent.id)}${qs}`, { method: 'GET' });
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

// ── Marketplace (AG16) ────────────────────────────────────────────────────────

export type PublishStatus = 'pending' | 'approved' | 'rejected' | null;

export interface MarketplaceListing {
  id: string;
  name: string;
  description: string | null;
  answerMode: AnswerMode;
  marketplaceTags: string[];
  publishedAt: string | null;
  version: number;
  toolConfig?: ToolConfig;
  tenantId?: string;
}

const MARKETPLACE_BASE = API_URLS.marketplace.base;

export const listMarketplace = async (opts?: { search?: string; tag?: string; limit?: number }): Promise<MarketplaceListing[]> => {
  const qs = new URLSearchParams();
  if (opts?.search) qs.set('search', opts.search);
  if (opts?.tag)    qs.set('tag', opts.tag);
  if (opts?.limit)  qs.set('limit', String(opts.limit));
  const data = await apiJson<{ agents: MarketplaceListing[] }>(`${MARKETPLACE_BASE}?${qs}`, { method: 'GET' });
  return data.agents ?? [];
};

export const installMarketplaceAgent = async (listingId: string): Promise<Agent> => {
  const data = await apiJson<{ agent: Agent }>(API_URLS.marketplace.install(listingId), { method: 'POST' });
  return data.agent;
};

export const publishAgentToMarketplace = async (agentId: string, tags?: string[]): Promise<void> => {
  await apiJson(API_URLS.agents.publish(agentId), {
    method: 'POST',
    body: tags ? { tags } : {},
  });
};

export const retractAgentFromMarketplace = async (agentId: string): Promise<void> => {
  await apiJson(API_URLS.agents.publish(agentId), { method: 'DELETE' });
};

// ── Agent teams (AG11) ────────────────────────────────────────────────────────

export interface TeamMember {
  agentId: string;
  name: string;
  routingHint: string;
}

export interface AgentTeam {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  coordinatorAgentId: string;
  members: TeamMember[];
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentTeamInput {
  name: string;
  description?: string;
  coordinatorAgentId: string;
  members?: TeamMember[];
}

export const listAgentTeams = async (): Promise<AgentTeam[]> => {
  const data = await apiJson<{ teams: AgentTeam[] }>(API_URLS.agentTeams.base, { method: 'GET' });
  return data.teams ?? [];
};

export const getAgentTeam = async (id: string): Promise<AgentTeam> => {
  const data = await apiJson<{ team: AgentTeam }>(API_URLS.agentTeams.team(id), { method: 'GET' });
  return data.team;
};

export const createAgentTeam = async (input: AgentTeamInput): Promise<AgentTeam> => {
  const data = await apiJson<{ team: AgentTeam }>(API_URLS.agentTeams.base, { method: 'POST', body: input });
  return data.team;
};

export const updateAgentTeam = async (id: string, input: Partial<AgentTeamInput>): Promise<AgentTeam> => {
  const data = await apiJson<{ team: AgentTeam }>(API_URLS.agentTeams.team(id), { method: 'PATCH', body: input });
  return data.team;
};

export const deleteAgentTeam = async (id: string): Promise<void> => {
  await apiJson(API_URLS.agentTeams.team(id), { method: 'DELETE' });
};

// ── Long-term memory (AG8) ────────────────────────────────────────────────────

export interface AgentMemoryFact {
  id: string;
  key: string;
  value: string;
  importance: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
}

export const addAgentMemory = async (
  agentId: string,
  key: string,
  value: string,
  importance?: number,
): Promise<void> => {
  await apiJson(API_URLS.agents.memory(agentId), {
    method: 'POST',
    body: { key, value, ...(importance !== undefined ? { importance } : {}) },
  });
};

export const listAgentMemory = async (agentId: string): Promise<AgentMemoryFact[]> => {
  const data = await apiJson<{ facts: AgentMemoryFact[] }>(
    API_URLS.agents.memory(agentId), { method: 'GET' },
  );
  return data.facts ?? [];
};

export const forgetAgentMemory = async (agentId: string, key: string): Promise<void> => {
  await apiJson(API_URLS.agents.memoryItem(agentId, key), { method: 'DELETE' });
};

export const clearAgentMemory = async (agentId: string): Promise<void> => {
  await apiJson(API_URLS.agents.memory(agentId), { method: 'DELETE' });
};

// ── OAuth integrations (AG6) ───────────────────────────────────────────────────

export interface OAuthConnectionInfo {
  id: string;
  provider: 'gdrive' | 'onedrive';
  accountEmail: string | null;
  expiresAt: string | null;
  connected: boolean;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  isFolder?: boolean;
}

export const listConnections = async (): Promise<{
  connections: OAuthConnectionInfo[];
  gdrive: { enabled: boolean };
  onedrive: { enabled: boolean };
}> => {
  return apiJson(API_URLS.integrations.base, { method: 'GET' });
};

export const disconnectIntegration = async (provider: 'gdrive' | 'onedrive'): Promise<void> => {
  await apiJson(API_URLS.integrations.provider(provider), { method: 'DELETE' });
};

export const listDriveFiles = async (
  provider: 'gdrive' | 'onedrive',
  opts?: { query?: string; pageSize?: number; parentId?: string; includeFolders?: boolean },
): Promise<{ files: DriveFile[]; nextPageToken: string | null }> => {
  const qs = new URLSearchParams();
  if (opts?.query) qs.set('query', opts.query);
  if (opts?.pageSize) qs.set('pageSize', String(opts.pageSize));
  if (opts?.parentId) qs.set('parentId', opts.parentId);
  if (opts?.includeFolders) qs.set('includeFolders', 'true');
  return apiJson(`${API_URLS.integrations.files(provider)}?${qs}`, { method: 'GET' });
};

export const getIntegrationAuthUrl = (provider: 'gdrive' | 'onedrive'): string =>
  API_URLS.integrations.auth(provider);

// ── MCP servers (AG-MCP) ───────────────────────────────────────────────────────

/**
 * A registered MCP server the caller can attach to an agent (own or shared).
 * Mirrors the backend MCPServer.toClientJSON() shape (secrets never included).
 */
export interface McpServerSummary {
  id: string;
  name: string;
  description: string | null;
  transport: string;
  status: string;
  shared: boolean;
  availableTools?: unknown[] | null;
}

export const listMcpServers = async (): Promise<McpServerSummary[]> => {
  const data = await apiJson<{ servers: McpServerSummary[] }>(API_URLS.mcp.servers, { method: 'GET' });
  return data.servers ?? [];
};

// ── Per-agent knowledge sources (AG4) ────────────────────────────────────────

export type KnowledgeSourceType =
  | 'web' | 'file_upload' | 'share_link'
  | 'gdrive_oauth' | 'onedrive_oauth'
  | 'gdrive_folder' | 'onedrive_folder';
export type KnowledgeSourceStatus = 'pending' | 'indexed' | 'error' | 'stale';

export interface AgentKnowledgeSource {
  id: string;
  type: KnowledgeSourceType;
  url: string | null;
  title: string | null;
  description: string | null;
  status: KnowledgeSourceStatus;
  chunkCount: number;
  bytesIndexed: number | null;
  lastIndexedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export const listKnowledgeSources = async (agentId: string): Promise<AgentKnowledgeSource[]> => {
  const data = await apiJson<{ sources: AgentKnowledgeSource[] }>(
    API_URLS.agents.knowledge(agentId), { method: 'GET' },
  );
  return data.sources ?? [];
};

export const addKnowledgeUrl = async (
  agentId: string,
  payload: { type: 'web' | 'share_link'; url: string; title?: string },
): Promise<AgentKnowledgeSource> => {
  const data = await apiJson<{ source: AgentKnowledgeSource }>(
    API_URLS.agents.knowledge(agentId),
    { method: 'POST', body: payload },
  );
  return data.source;
};

export const addKnowledgeFile = async (
  agentId: string,
  file: File,
): Promise<AgentKnowledgeSource> => {
  const form = new FormData();
  form.append('type', 'file_upload');
  form.append('file', file);
  const res = await apiFetch(API_URLS.agents.knowledge(agentId), {
    method: 'POST',
    body: form as unknown as Record<string, unknown>,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.error as string) || `Upload failed (${res.status})`);
  }
  const data = await res.json() as { source: AgentKnowledgeSource };
  return data.source;
};

export const addKnowledgeDriveFile = async (
  agentId: string,
  provider: 'gdrive' | 'onedrive',
  file: DriveFile,
): Promise<AgentKnowledgeSource> => {
  const data = await apiJson<{ source: AgentKnowledgeSource }>(
    API_URLS.agents.knowledge(agentId),
    {
      method: 'POST',
      body: {
        type: provider === 'gdrive' ? 'gdrive_oauth' : 'onedrive_oauth',
        fileId: file.id,
        mimeType: file.mimeType,
        fileName: file.name,
        title: file.name,
      },
    },
  );
  return data.source;
};

/**
 * Attach a whole Drive/OneDrive folder. The backend spawns and reconciles one
 * per-file child source for every file in the folder subtree (folderSync).
 */
export const addKnowledgeDriveFolder = async (
  agentId: string,
  provider: 'gdrive' | 'onedrive',
  folder: { id: string; name: string },
): Promise<AgentKnowledgeSource> => {
  const data = await apiJson<{ source: AgentKnowledgeSource }>(
    API_URLS.agents.knowledge(agentId),
    {
      method: 'POST',
      body: {
        type: provider === 'gdrive' ? 'gdrive_folder' : 'onedrive_folder',
        folderId: folder.id,
        folderName: folder.name,
        title: folder.name,
      },
    },
  );
  return data.source;
};

export const reindexKnowledgeSource = async (agentId: string, sourceId: string): Promise<void> => {
  await apiJson(API_URLS.agents.knowledgeReindex(agentId, sourceId), { method: 'POST' });
};

export const deleteKnowledgeSource = async (agentId: string, sourceId: string): Promise<void> => {
  await apiJson(API_URLS.agents.knowledgeItem(agentId, sourceId), { method: 'DELETE' });
};

// ── Agent run logs ────────────────────────────────────────────────────────────

export interface AgentRunSummary {
  id: string;
  agentId: string;
  userId: string | null;
  sessionId: string | null;
  status: 'running' | 'completed' | 'blocked' | 'error';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  stepCount: number;
  totalTokens: number;
  totalCredits: number;
  errorMessage: string | null;
}

export const listAgentRuns = async (agentId: string, limit = 20, offset = 0): Promise<AgentRunSummary[]> => {
  const data = await apiJson<{ runs: AgentRunSummary[] }>(
    `${API_URLS.agents.runs(agentId)}?limit=${limit}&offset=${offset}`,
    { method: 'GET' },
  );
  return data.runs ?? [];
};
export const listChatModels = async (): Promise<ChatModelOption[]> => {
  try {
    const data = await apiJson<{ models?: ChatModelOption[] }>(API_URLS.chatModels, { method: 'GET' });
    return data.models ?? [];
  } catch {
    return [];
  }
};
