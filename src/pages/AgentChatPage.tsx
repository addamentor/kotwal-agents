import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Send, Loader2, ExternalLink, AlertTriangle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAgent, listChatModels, Agent, ChatModelOption } from '@/services/agentApi';
import { streamAgentMessage, ChatMessage, msgId } from '@/services/chatApi';

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) || 'https://app.aikotwal.com';

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {msg.content}
        {streaming && (
          <span className="ml-1 inline-block h-3.5 w-0.5 bg-current opacity-75 animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [agent, setAgent]         = useState<Agent | null>(null);
  const [models, setModels]       = useState<ChatModelOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [redacted, setRedacted]   = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load agent + models on mount.
  useEffect(() => {
    if (!id) return;
    Promise.all([getAgent(id), listChatModels()])
      .then(([a, m]) => { setAgent(a); setModels(m); })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load agent.'));
  }, [id]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingId]);

  // Pick the best modelId: agent's pinned model, else first available, else ''.
  const modelId = agent?.modelId
    ?? (models.length > 0 ? models[0].id : '');

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !agent || !modelId) return;

    setInput('');
    setRedacted(false);
    setSending(true);

    // Append the user message immediately.
    const userMsg: ChatMessage = { role: 'user', content: text, id: msgId() };
    setMessages(prev => [...prev, userMsg]);

    // Create a placeholder assistant message for streaming.
    const assistantId = msgId();
    const placeholderMsg: ChatMessage = { role: 'assistant', content: '', id: assistantId };
    setMessages(prev => [...prev, placeholderMsg]);
    setStreamingId(assistantId);

    let accumulated = '';

    const newSessionId = await streamAgentMessage({
      message:   text,
      modelId,
      agentId:   agent.id,
      sessionId,
      callbacks: {
        onToken: (delta) => {
          accumulated += delta;
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m),
          );
        },
        onDone: (meta) => {
          if (meta.sessionId) setSessionId(meta.sessionId);
        },
        onError: (msg) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId
              ? { ...m, content: accumulated || `[Error: ${msg}]` }
              : m),
          );
        },
        onDetection: (data) => {
          if (data.messageRedacted) setRedacted(true);
        },
      },
    });

    if (newSessionId) setSessionId(newSessionId);
    setStreamingId(null);
    setSending(false);
    textareaRef.current?.focus();
  }, [input, sending, agent, modelId, sessionId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // ── Error / loading states ────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p>{loadError}</p>
        <Button size="sm" variant="ghost" onClick={() => navigate('/')}>Back to agents</Button>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />Loading…
      </div>
    );
  }

  const noModel = !modelId;

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{agent.name}</p>
          {agent.description && (
            <p className="text-[10px] text-muted-foreground truncate">{agent.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px] capitalize">{agent.answerMode}</Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            title="Open runs"
            onClick={() => navigate(`/agents/${agent.id}/runs`)}
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>
          <a
            href={`${APP_URL}/?agentId=${encodeURIComponent(agent.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            title="Open in full chat app"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm py-20">
            <Bot className="h-8 w-8 opacity-30" />
            <p>Start a conversation with <strong>{agent.name}</strong></p>
            {agent.instructions && (
              <p className="text-xs text-center max-w-sm opacity-60">{agent.instructions.slice(0, 120)}{agent.instructions.length > 120 ? '…' : ''}</p>
            )}
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            streaming={streamingId === msg.id}
          />
        ))}
        {redacted && (
          <p className="text-xs text-amber-500 text-center">
            Sensitive data was redacted from your message before it was sent to the model.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        {noModel && (
          <p className="text-xs text-amber-500 mb-2 text-center">
            No model available for this agent. Configure a model in the agent settings.
          </p>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            className="flex-1 min-h-[44px] max-h-40 resize-none text-sm"
            placeholder={noModel ? 'No model configured' : 'Message…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || noModel}
            rows={1}
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] shrink-0"
            onClick={() => void send()}
            disabled={sending || !input.trim() || noModel}
          >
            {sending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
