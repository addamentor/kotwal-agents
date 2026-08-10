import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bot, Send, Loader2, ExternalLink, AlertTriangle,
  Activity, Brain, Paperclip, Monitor, Square, ChevronDown, ChevronUp, Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { getAgent, listChatModels, Agent, ChatModelOption } from '@/services/agentApi';
import { streamAgentMessage, captureScreen, ChatMessage, ToolEvent, msgId } from '@/services/chatApi';
import AddMemoryPopover from '@/components/AddMemoryPopover';

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) || 'https://app.aikotwal.com';

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
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

interface ToolChipProps { calls: Array<{ name: string; result?: unknown }> }

function ToolChips({ calls }: ToolChipProps) {
  const [expanded, setExpanded] = useState(false);
  if (!calls.length) return null;
  return (
    <div className="ml-10 space-y-1">
      <button
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {calls.length} tool call{calls.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="space-y-1">
          {calls.map((c, i) => (
            <div key={i} className="rounded-lg bg-muted/50 border border-border px-2.5 py-1.5 text-[10px]">
              <span className="font-mono font-semibold text-primary">{c.name}</span>
              {c.result !== undefined && (
                <pre className="mt-1 text-muted-foreground whitespace-pre-wrap max-h-20 overflow-y-auto">
                  {typeof c.result === 'string' ? c.result : JSON.stringify(c.result, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageBlock({ b64, url, alt, mimeType }: { b64?: string; url?: string; alt?: string; mimeType: string }) {
  const src = b64 ? `data:${mimeType};base64,${b64}` : url;
  if (!src) return null;
  return (
    <div className="ml-10 mt-1">
      <img src={src} alt={alt || 'Generated image'} className="rounded-lg max-w-sm max-h-64 object-contain border border-border" />
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
  const [toolEvents, setToolEvents] = useState<Record<string, Array<{ name: string; result?: unknown }>>>({});
  const [images, setImages]       = useState<Record<string, Array<{ b64?: string; url?: string; alt?: string; mimeType: string }>>>({});
  const [input, setInput]         = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sending, setSending]     = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [redacted, setRedacted]   = useState(false);
  const [capturing, setCapturing] = useState(false);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const abortRef      = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAgent(id), listChatModels()])
      .then(([a, m]) => { setAgent(a); setModels(m); })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load agent.'));
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingId]);

  const modelId = agent?.modelId ?? (models.length > 0 ? models[0].id : '');

  const handleAbort = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingId(null);
    setSending(false);
  };

  const handleScreenCapture = async () => {
    setCapturing(true);
    try {
      const file = await captureScreen();
      if (file) {
        setAttachedFile(file);
        toast({ title: 'Screenshot captured', description: 'Attached to your next message.' });
      }
    } catch (e) {
      toast({ title: 'Screen capture failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setCapturing(false); }
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text && !attachedFile || sending || !agent || !modelId) return;

    const currentFile = attachedFile;
    setInput('');
    setAttachedFile(null);
    setRedacted(false);
    setSending(true);

    const label = text || (currentFile ? `[Attached: ${currentFile.name}]` : '');
    const userMsg: ChatMessage = { role: 'user', content: label, id: msgId() };
    setMessages(prev => [...prev, userMsg]);

    const assistantId = msgId();
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }]);
    setStreamingId(assistantId);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let accumulated = '';
    const pendingTools: Array<{ name: string; result?: unknown }> = [];

    const newSessionId = await streamAgentMessage({
      message:     text || (currentFile?.name ?? 'Please analyse the attached file.'),
      modelId,
      agentId:     agent.id,
      sessionId,
      file:        currentFile,
      abortSignal: ctrl.signal,
      callbacks: {
        onToken: (delta) => {
          accumulated += delta;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
        },
        onToolCall: (ev: ToolEvent) => {
          pendingTools.push({ name: ev.name });
          setToolEvents(prev => ({ ...prev, [assistantId]: [...pendingTools] }));
        },
        onToolResult: (ev: ToolEvent) => {
          const t = pendingTools.find(p => p.name === ev.name && p.result === undefined);
          if (t) t.result = ev.result;
          setToolEvents(prev => ({ ...prev, [assistantId]: [...pendingTools] }));
        },
        onImage: (img) => {
          setImages(prev => ({ ...prev, [assistantId]: [...(prev[assistantId] || []), img] }));
        },
        onDone: (meta) => { if (meta.sessionId) setSessionId(meta.sessionId); },
        onError: (msg) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: accumulated || `[Error: ${msg}]` } : m,
          ));
        },
        onDetection: (data) => { if (data.messageRedacted) setRedacted(true); },
      },
    });

    if (newSessionId) setSessionId(newSessionId);
    abortRef.current = null;
    setStreamingId(null);
    setSending(false);
    textareaRef.current?.focus();
  }, [input, attachedFile, sending, agent, modelId, sessionId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

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
    return <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>;
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
          {agent.description && <p className="text-[10px] text-muted-foreground truncate">{agent.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px] capitalize">{agent.answerMode}</Badge>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" title="View runs"
            onClick={() => navigate(`/agents/${agent.id}/runs`)}><Activity className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" title="View memory"
            onClick={() => navigate(`/agents/${agent.id}/memory`)}><Brain className="h-3.5 w-3.5" /></Button>
          {agent && <AddMemoryPopover agentId={agent.id} compact />}
          <a href={`${APP_URL}/?agentId=${encodeURIComponent(agent.id)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            title="Open in full chat app"><ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm py-20">
            <Bot className="h-8 w-8 opacity-30" />
            <p>Start a conversation with <strong>{agent.name}</strong></p>
            {agent.instructions && (
              <p className="text-xs text-center max-w-sm opacity-60">
                {agent.instructions.slice(0, 120)}{agent.instructions.length > 120 ? '…' : ''}
              </p>
            )}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="space-y-1">
            <MessageBubble msg={msg} streaming={streamingId === msg.id} />
            {msg.role === 'assistant' && toolEvents[msg.id]?.length > 0 && (
              <ToolChips calls={toolEvents[msg.id]} />
            )}
            {msg.role === 'assistant' && images[msg.id]?.map((img, i) => (
              <ImageBlock key={i} {...img} />
            ))}
          </div>
        ))}
        {redacted && (
          <p className="text-xs text-amber-500 text-center">Sensitive data was redacted from your message.</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        {/* File attachment preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 text-xs bg-muted rounded-lg px-3 py-1.5">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate flex-1">{attachedFile.name}</span>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => setAttachedFile(null)}>✕</button>
          </div>
        )}
        {noModel && (
          <p className="text-xs text-amber-500 text-center">No model available. Configure a model in agent settings.</p>
        )}
        <div className="flex gap-2 items-end">
          {/* Tool buttons */}
          <div className="flex gap-1 shrink-0">
            <input ref={fileInputRef} type="file" className="hidden"
              accept=".txt,.md,.pdf,.html,.csv,.docx,.doc,image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = ''; }} />
            <Button size="icon" variant="ghost" className="h-9 w-9" title="Attach file" disabled={sending}
              onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" title="Capture screen" disabled={sending || capturing}
              onClick={() => void handleScreenCapture()}>
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}
            </Button>
          </div>

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

          {sending ? (
            <Button size="icon" variant="destructive" className="h-[44px] w-[44px] shrink-0" title="Abort" onClick={handleAbort}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" className="h-[44px] w-[44px] shrink-0"
              onClick={() => void send()} disabled={(!input.trim() && !attachedFile) || noModel}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">Enter to send · Shift+Enter for new line · ■ to abort</p>
      </div>
    </div>
  );
}
