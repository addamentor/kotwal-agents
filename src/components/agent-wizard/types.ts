/**
 * Shared draft model for the staged agent wizard.
 *
 * A `DraftFields` object is the single mutable source of truth the wizard edits;
 * `fieldsFromAgent` seeds it (create defaults or an existing agent for edit mode)
 * and `fieldsToInput` maps it back to the `AgentInput` the API expects. Keeping
 * this mapping in one place means every step reads/writes the same shape and the
 * persistence layer never re-derives field logic.
 */
import {
  Agent, AgentInput, AgentType, AnswerMode, ProxyAuthType, ToolConfig, emptyToolConfig,
} from '@/services/agentApi';

export interface DraftFields {
  name: string;
  description: string;
  instructions: string;
  answerMode: AnswerMode;
  modelId: string;            // 'auto' sentinel → null on submit
  shared: boolean;
  toolConfig: ToolConfig;
  // Proxy (3rd-party) agent
  agentType: AgentType;
  proxyUrl: string;
  proxyAuthType: ProxyAuthType;
  proxyAuthHeader: string;
  proxyAuthSecret: string;    // write-only; never pre-filled from an existing agent
  proxyResponsePath: string;
}

/** Seed draft fields from an existing agent (edit mode) or defaults (create mode). */
export function fieldsFromAgent(agent: Agent | null): DraftFields {
  return {
    name:              agent?.name ?? '',
    description:       agent?.description ?? '',
    instructions:      agent?.instructions ?? '',
    answerMode:        agent?.answerMode ?? 'hybrid',
    modelId:           agent?.modelId ?? 'auto',
    shared:            agent?.shared ?? false,
    toolConfig:        agent?.toolConfig ?? emptyToolConfig(),
    agentType:         agent?.agentType ?? 'kotwal',
    proxyUrl:          agent?.proxyUrl ?? '',
    proxyAuthType:     agent?.proxyAuthType ?? 'none',
    proxyAuthHeader:   agent?.proxyAuthHeader ?? '',
    proxyAuthSecret:   '',
    proxyResponsePath: agent?.proxyResponsePath ?? '',
  };
}

/**
 * Map draft fields to an AgentInput. Proxy fields are only included when the
 * agent is a proxy, mirroring the original AgentForm behaviour. `status`, when
 * provided by the caller (e.g. 'inactive' for a draft, 'active' on finalize), is
 * merged in on top.
 */
export function fieldsToInput(f: DraftFields, extra: Partial<AgentInput> = {}): AgentInput {
  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    instructions: f.instructions.trim() || undefined,
    answerMode: f.answerMode,
    modelId: f.modelId === 'auto' ? null : f.modelId,
    shared: f.shared,
    toolConfig: f.toolConfig,
    agentType: f.agentType,
    ...(f.agentType === 'proxy' ? {
      proxyUrl: f.proxyUrl.trim() || null,
      proxyAuthType: f.proxyAuthType,
      proxyAuthHeader: f.proxyAuthType === 'header' ? (f.proxyAuthHeader.trim() || null) : null,
      proxyAuthSecret: f.proxyAuthSecret.trim() || null,
      proxyResponsePath: f.proxyResponsePath.trim() || null,
    } : {}),
    ...extra,
  };
}

/** Human-readable validation error, or null when the fields are valid to persist. */
export function validateDraft(f: DraftFields): string | null {
  if (!f.name.trim()) return 'Give your agent a name.';
  if (f.agentType === 'proxy' && !f.proxyUrl.trim()) return 'A proxy URL is required for a 3rd-party agent.';
  return null;
}

export const ANSWER_MODES: { value: AnswerMode; label: string; hint: string }[] = [
  { value: 'strict', label: 'Only my sources',       hint: 'Answers strictly from attached knowledge. If the answer is not in your sources, it says so instead of guessing.' },
  { value: 'hybrid', label: 'My sources + AI',        hint: 'Prefers your attached knowledge and cites it, then falls back to the model — clearly flagging when it does.' },
  { value: 'open',   label: 'Open assistant',         hint: 'No knowledge grounding. A normal assistant that follows your persona instructions only.' },
];
