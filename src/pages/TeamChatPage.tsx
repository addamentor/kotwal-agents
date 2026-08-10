import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Send, Loader2, AlertTriangle, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAgentTeam, listChatModels, AgentTeam, ChatModelOption } from '@/services/agentApi';
import { API_BASE_URL } from '@/lib/url';
import { apiFetch } from '@/lib/apiClient';
import { msgId } from '@/services/chatApi';

interface ChatMessage { role: 'user' | 'assistant'; content: string; id: string }
interface SubAgentEvent { agentName: string; messageType: string; payload: string }

function MessageBubble({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-3.5 w-3.5" />
        </div>
      )}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
        isUser ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm',
      )}>
        {msg.content}
        {streaming && <span className="ml-1 inline-block h-3.5 w-0.5 bg-current opacity-75 animate-pulse" />}
      </div>
    </div>
  );
}

function SubAgentNotice({ events }: { events: SubAgentEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="flex flex-col gap-1 px-2">
      {events.map((e, i) => (
        <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Bot className="h-2.5 w-2.5 shrink-0" />
          <span className="font-medium">{e.agentName}</span>
          <Badge variant="outline" className="text-[9px] py-0 px-1">{e.messageType}</Badge>
          <span className="truncate">{e.payload.slice(0, 80)}</span>
        </div>
      ))}
    </div>
  );
}

export default function TeamChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [team, setTeam]         = useState<AgentTeam | null>(null);
  const [models, setModels]     = useState<ChatModelOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subEvents, setSubEvents] = useState<SubAgentEvent[]>([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAgentTeam(id), listChatModels()])
      .then(([t, m]) => { setTeam(t); setModels(m); })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load team.'));
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const modelId = models.length > 0 ? models[0].id : '';

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !team || !modelId) return;
    setInput('');
    setSubEvents([]);
    setSending(true);

    const userMsg: ChatMessage = { role: 'user', content: text, id: msgId() };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = msgId();
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }]);
    setStreamingId(assistantId);

    let accumulated = '';

    try {
      const body: Record<string, unknown> = { message: text, modelId };
      if (sessionId) body.sessionId = sessionId;

      const res = await apiFetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        body,
        headers: { Accept: 'text/event-stream', 'x-agent-team-id': team.id },
      });

      if (!res.ok || !res.body) {
        throw new Error(`Stream failed (${res.status})`);
      }

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
          if (line.startsWith('event:')) { currentEvent = line.slice(6).trim(); continue; }
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw) as Record<string, unknown>;
            if (currentEvent === 'token') {
              accumulated += (data.text as string) ?? '';
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
            } else if (currentEvent === 'sub_agent_message') {
              setSubEvents(prev => [...prev, {
                agentName:   (data.agentName as string) || 'Agent',
                messageType: (data.messageType as string) || 'result',
                payload:     (data.payload as string) || '',
              }]);
            } else if (currentEvent === 'done') {
              if (data.sessionId) setSessionId(data.sessionId as string);
            }
            currentEvent = '';
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: accumulated || `[Error: ${(err as Error).message}]` } : m,
      ));
    }

    setStreamingId(null);
    setSending(false);
    textareaRef.current?.focus();
  }, [input, sending, team, modelId, sessionId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p>{loadError}</p>
        <Button size="sm" variant="ghost" onClick={() => navigate('/teams')}>Back to teams</Button>
      </div>
    );
  }

  if (!team) {
    return <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate('/teams')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Users className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{team.name}</p>
          <p className="text-[10px] text-muted-foreground">{team.members.length} specialist{team.members.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm py-20">
            <Users className="h-8 w-8 opacity-30" />
            <p>Start a conversation with the <strong>{team.name}</strong> team</p>
            {team.members.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center mt-1">
                {team.members.map(m => <Badge key={m.agentId} variant="outline" className="text-[10px]">{m.name}</Badge>)}
              </div>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <MessageBubble msg={msg} streaming={streamingId === msg.id} />
            {msg.role === 'assistant' && i === messages.length - 1 && subEvents.length > 0 && (
              <div className="mt-2"><SubAgentNotice events={subEvents} /></div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            className="flex-1 min-h-[44px] max-h-40 resize-none text-sm"
            placeholder="Message the team…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || !modelId}
            rows={1}
          />
          <Button size="icon" className="h-[44px] w-[44px] shrink-0"
            onClick={() => void send()} disabled={sending || !input.trim() || !modelId}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
