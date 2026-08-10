/**
 * chatApi — SSE streaming client for the Agentverse in-app chat.
 *
 * AG15 additions:
 *   - file?: File attachment (sent as multipart/form-data)
 *   - onToolCall / onToolResult callbacks for inline tool chips
 *   - AbortController support for Pause/Abort
 *   - captureScreen() — browser screen capture via getDisplayMedia()
 */
import { API_BASE_URL } from '@/lib/url';
import { apiFetch } from '@/lib/apiClient';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

export interface ToolEvent {
  name: string;
  result?: unknown;
}

export interface StreamCallbacks {
  onToken:      (text: string) => void;
  onDone:       (meta: { sessionId?: string; creditsCharged?: number; agentId?: string }) => void;
  onError:      (msg: string) => void;
  onDetection?: (data: { action: string; messageRedacted?: boolean }) => void;
  onToolCall?:  (ev: ToolEvent) => void;
  onToolResult?:(ev: ToolEvent) => void;
  onArtifact?:  (art: { filename: string; kind: string; url?: string }) => void;
  onImage?:     (img: { mimeType: string; alt?: string; b64?: string; url?: string }) => void;
}

/**
 * Stream a single chat turn to the agent.
 * Returns the sessionId after the turn completes (or null on abort/error).
 *
 * @param abortSignal  pass an AbortController's signal to support Pause/Abort
 */
export async function streamAgentMessage(params: {
  message:      string;
  modelId:      string;
  agentId:      string;
  sessionId:    string | null;
  callbacks:    StreamCallbacks;
  file?:        File | null;
  abortSignal?: AbortSignal;
}): Promise<string | null> {
  const { message, modelId, agentId, sessionId, callbacks, file, abortSignal } = params;

  let finalSessionId: string | null = sessionId;

  try {
    // Build body — multipart when a file is attached, JSON otherwise.
    let fetchBody: FormData | Record<string, unknown>;
    const extraHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'x-agent-id': agentId,
    };

    if (file) {
      const form = new FormData();
      form.append('message', message);
      form.append('modelId', modelId);
      if (sessionId) form.append('sessionId', sessionId);
      form.append('file', file);
      fetchBody = form as unknown as Record<string, unknown>;
      // Do NOT set Content-Type for FormData — browser sets it with the boundary.
      delete extraHeaders['Content-Type'];
    } else {
      fetchBody = { message, modelId, ...(sessionId ? { sessionId } : {}) };
    }

    const res = await apiFetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      body: fetchBody,
      headers: extraHeaders,
      ...(abortSignal ? { signal: abortSignal } : {}),
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
      if (abortSignal?.aborted) { reader.cancel(); break; }
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
              case 'tool_call':
                callbacks.onToolCall?.({ name: (data.name as string) ?? '' });
                break;
              case 'tool_result':
                callbacks.onToolResult?.({ name: (data.name as string) ?? '', result: data.result });
                break;
              case 'artifact':
                callbacks.onArtifact?.({
                  filename: (data.filename as string) ?? 'file',
                  kind:     (data.kind as string) ?? 'document',
                  url:      data.url as string | undefined,
                });
                break;
              case 'image':
                callbacks.onImage?.({
                  mimeType: (data.mimeType as string) ?? 'image/png',
                  alt:      data.alt as string | undefined,
                  b64:      data.b64 as string | undefined,
                  url:      data.url as string | undefined,
                });
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
    if ((err as Error).name === 'AbortError') return finalSessionId; // clean abort
    callbacks.onError((err as Error).message ?? 'Network error.');
  }

  return finalSessionId;
}

/** Generate a stable client-side message id. */
export function msgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Capture a screenshot using the browser's Screen Capture API.
 * Returns a PNG File or null if the user denies permission.
 */
export async function captureScreen(): Promise<File | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: { displaySurface: 'monitor' },
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capture = new (window as any).ImageCapture(track);
    const bitmap  = await capture.grabFrame();
    track.stop();

    const canvas  = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);

    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], 'screenshot.png', { type: 'image/png' }) : null);
      }, 'image/png');
    });
  } catch {
    return null;
  }
}
