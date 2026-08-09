/**
 * chatApi — minimal SSE streaming client for the Agentverse in-app chat.
 *
 * Uses the same /api/chat/stream endpoint as the main app (not the agent-stream
 * endpoint — the agentverse app doesn't have local tool execution capability).
 * The agent is selected via the x-agent-id header so all agent grounding,
 * knowledge retrieval, and detection apply.
 */
import { API_BASE_URL } from '@/lib/url';
import { apiFetch } from '@/lib/apiClient';
import { tokenStore } from '@/lib/tokenStore';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

export interface StreamCallbacks {
  onToken:    (text: string) => void;
  onDone:     (meta: { sessionId?: string; creditsCharged?: number; agentId?: string }) => void;
  onError:    (msg: string) => void;
  onDetection?: (data: { action: string; messageRedacted?: boolean }) => void;
}

/**
 * Stream a single chat turn to the agent.
 * Returns the sessionId after the turn completes.
 */
export async function streamAgentMessage(params: {
  message:   string;
  modelId:   string;
  agentId:   string;
  sessionId: string | null;
  callbacks: StreamCallbacks;
}): Promise<string | null> {
  const { message, modelId, agentId, sessionId, callbacks } = params;

  const body: Record<string, unknown> = { message, modelId };
  if (sessionId) body.sessionId = sessionId;

  let finalSessionId: string | null = sessionId;

  try {
    const res = await apiFetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      body,
      headers: {
        Accept: 'text/event-stream',
        'x-agent-id': agentId,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = `Chat failed (${res.status})`;
      try { msg = (JSON.parse(text) as { error?: string }).error ?? msg; } catch { /* */ }
      callbacks.onError(msg);
      return finalSessionId;
    }

    if (!res.body) { callbacks.onError('No response body.'); return finalSessionId; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw) as Record<string, unknown>;
            switch (currentEvent) {
              case 'token':
                callbacks.onToken((data.text as string) ?? '');
                break;
              case 'done':
                finalSessionId = (data.sessionId as string) ?? finalSessionId;
                callbacks.onDone({
                  sessionId:      finalSessionId ?? undefined,
                  creditsCharged: data.creditsCharged as number | undefined,
                  agentId:        data.agentId as string | undefined,
                });
                break;
              case 'error':
                callbacks.onError((data.message as string) ?? 'Unknown error.');
                break;
              case 'detection':
                callbacks.onDetection?.(data as { action: string; messageRedacted?: boolean });
                break;
            }
            currentEvent = '';
          } catch { /* skip malformed frame */ }
        }
      }
    }
  } catch (err) {
    callbacks.onError((err as Error).message ?? 'Network error.');
  }

  return finalSessionId;
}

/** Generate a stable client-side message id. */
export function msgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Check if a model list contains at least one available model for the agent. */
export function hasModel(modelId: string | null | undefined): boolean {
  return !!(modelId && modelId !== 'auto');
}
