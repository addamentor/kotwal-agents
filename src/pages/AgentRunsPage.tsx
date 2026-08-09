import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAgent, listAgentRuns, Agent, AgentRunSummary } from '@/services/agentApi';

function statusIcon(status: AgentRunSummary['status']) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'error':     return <XCircle      className="h-3.5 w-3.5 text-destructive" />;
    case 'blocked':   return <AlertCircle  className="h-3.5 w-3.5 text-amber-500" />;
    default:          return <Clock        className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />;
  }
}

function statusVariant(status: AgentRunSummary['status']): 'outline' | 'destructive' | 'secondary' {
  if (status === 'error' || status === 'blocked') return 'destructive';
  if (status === 'running') return 'secondary';
  return 'outline';
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AgentRunsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [agent, setAgent]   = useState<Agent | null>(null);
  const [runs, setRuns]     = useState<AgentRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, r] = await Promise.all([getAgent(id), listAgentRuns(id, 50)]);
      setAgent(a);
      setRuns(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-3xl">
      <header className="mb-5 flex items-center gap-3">
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate(`/agents/${id}/chat`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
          <h1 className="text-xl font-semibold mt-0.5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {agent ? `${agent.name} — Runs` : 'Agent Runs'}
          </h1>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </Button>
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
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Activity className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm text-muted-foreground">No runs yet. Chat with this agent to see run history.</p>
          <Button className="mt-4 gap-1.5" size="sm" onClick={() => navigate(`/agents/${id}/chat`)}>
            Start chatting
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <div key={run.id} className="rounded-xl border border-border px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5">{statusIcon(run.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={statusVariant(run.status)} className="text-[10px] capitalize">
                    {run.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fmtTime(run.startedAt)}</span>
                  {run.durationMs !== null && (
                    <span className="text-xs text-muted-foreground">{fmtDuration(run.durationMs)}</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                  {run.totalTokens > 0 && <span>{run.totalTokens.toLocaleString()} tokens</span>}
                  {run.totalCredits > 0 && <span>{run.totalCredits.toFixed(4)} credits</span>}
                  {run.stepCount > 0 && <span>{run.stepCount} steps</span>}
                  {run.sessionId && (
                    <span className={cn('font-mono text-[10px] truncate max-w-[120px]')} title={run.sessionId}>
                      session {run.sessionId.slice(0, 8)}
                    </span>
                  )}
                </div>
                {run.errorMessage && (
                  <p className="mt-1 text-xs text-destructive truncate">{run.errorMessage}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
