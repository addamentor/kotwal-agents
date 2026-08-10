import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { AgentMemoryFact, getAgent, listAgentMemory, forgetAgentMemory, clearAgentMemory, Agent } from '@/services/agentApi';
import AddMemoryPopover from '@/components/AddMemoryPopover';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AgentMemoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [agent, setAgent]   = useState<Agent | null>(null);
  const [facts, setFacts]   = useState<AgentMemoryFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, f] = await Promise.all([getAgent(id), listAgentMemory(id)]);
      setAgent(a);
      setFacts(f);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memory.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleForget = async (fact: AgentMemoryFact) => {
    if (!id) return;
    setBusyKey(fact.key);
    try {
      await forgetAgentMemory(id, fact.key);
      setFacts(prev => prev.filter(f => f.key !== fact.key));
      toast({ title: `Forgot "${fact.key}"` });
    } catch (e) {
      toast({ title: 'Failed to forget', variant: 'destructive',
        description: e instanceof Error ? e.message : undefined });
    } finally { setBusyKey(null); }
  };

  const handleClearAll = async () => {
    if (!id || !window.confirm('Clear ALL memory for this agent? This cannot be undone.')) return;
    setClearing(true);
    try {
      await clearAgentMemory(id);
      setFacts([]);
      toast({ title: 'Memory cleared' });
    } catch (e) {
      toast({ title: 'Failed to clear', variant: 'destructive',
        description: e instanceof Error ? e.message : undefined });
    } finally { setClearing(false); }
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-5 flex items-center gap-3">
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
          onClick={() => navigate(`/agents/${id}/chat`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
          <h1 className="text-xl font-semibold mt-0.5 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            {agent ? `${agent.name} — Memory` : 'Agent Memory'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Facts this agent has remembered about you across sessions.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
        {id && <AddMemoryPopover agentId={id} onSaved={() => void load()} />}
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />Loading…
        </div>
      ) : error ? (
        <div className="py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />Retry
          </Button>
        </div>
      ) : facts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Brain className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No memories yet. Chat with this agent and it will remember facts across sessions.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The agent writes facts using{' '}
            <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">
              {'<remember key="...">value</remember>'}
            </code>
            {' '}tags.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={clearing}
              onClick={() => void handleClearAll()}
            >
              {clearing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <XCircle className="h-3.5 w-3.5" />}
              Clear all memory
            </Button>
          </div>

          <div className="space-y-2">
            {facts.map(fact => (
              <div key={fact.key}
                className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-primary">{fact.key}</span>
                    <Badge variant="outline" className="text-[10px]">
                      importance {fact.importance.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{fact.value}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Remembered {fmtDate(fact.createdAt)}</span>
                    {fact.lastAccessedAt && (
                      <span>Last used {fmtDate(fact.lastAccessedAt)}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={busyKey === fact.key}
                  title={`Forget "${fact.key}"`}
                  onClick={() => void handleForget(fact)}
                >
                  {busyKey === fact.key
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
