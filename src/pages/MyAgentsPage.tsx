import React, { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, Plus, Trash2, Pencil, Bot, Loader2, RefreshCw, Globe2, Lock, Download, FolderOpen, Monitor, Terminal, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import AgentForm from '@/components/AgentForm';
import { Agent, listOwnAgents, deleteAgent, updateAgent, downloadAgent } from '@/services/agentApi';

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAgents(await listOwnAgents()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load agents'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onSaved = (a: Agent) => {
    setEditing(null);
    setAgents((prev) => {
      const i = prev.findIndex((x) => x.id === a.id);
      if (i === -1) return [a, ...prev];
      const copy = [...prev]; copy[i] = a; return copy;
    });
  };

  const remove = async (a: Agent) => {
    if (!window.confirm('Delete agent "' + a.name + '"?')) return;
    setBusyId(a.id);
    try { await deleteAgent(a.id); setAgents((prev) => prev.filter((x) => x.id !== a.id)); }
    catch (e) { toast({ title: 'Delete failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined }); }
    finally { setBusyId(null); }
  };

  const toggleShared = async (a: Agent) => {
    setBusyId(a.id);
    try {
      const updated = await updateAgent(a.id, { shared: !a.shared });
      setAgents((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      toast({ title: updated.shared ? 'Shared with your organization' : 'Unshared' });
    } catch (e) {
      toast({ title: 'Update failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); }
  };

  const handleDownload = async (a: Agent) => {
    setDownloadingId(a.id);
    try {
      await downloadAgent(a);
      const cliName = a.name.replace(/\s+/g, '-').toLowerCase() + '.kotwal-agent.json';
      toast({ title: 'Bundle downloaded', description: 'Run with: npx kotwal-agent run ' + cliName });
    } catch (e) {
      toast({ title: 'Download failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setDownloadingId(null); }
  };

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />My Agents
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create custom agents, give them a persona, and share them with your team.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />New agent</Button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : error ? (
        <div className="py-8">
          <p className="text-sm text-[hsl(var(--danger))]">{error}</p>
          <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={load}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Bot className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm text-muted-foreground">No agents yet. Create your first one to get started.</p>
          <Button className="mt-4 gap-1.5" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />New agent</Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => {
            const caps = [
              a.toolConfig?.fileAccess?.enabled    && { icon: FolderOpen, label: 'Files' },
              a.toolConfig?.screenCapture?.enabled && { icon: Monitor,    label: 'Screen' },
              a.toolConfig?.shellExec?.enabled     && { icon: Terminal,   label: 'Shell' },
              a.toolConfig?.webSearch              && { icon: Globe,      label: 'Web' },
            ].filter(Boolean) as { icon: React.ElementType; label: string }[];

            return (
              <li key={a.id} className="rounded-xl border border-border p-4 flex flex-col">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0"><Bot className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{a.name}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize">{a.answerMode}</Badge>
                      {a.shared
                        ? <Badge variant="outline" className="text-[10px] gap-1 border-[hsl(var(--success)/0.3)] text-[hsl(var(--success))]"><Globe2 className="h-2.5 w-2.5" />Shared</Badge>
                        : <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground"><Lock className="h-2.5 w-2.5" />Private</Badge>}
                      {caps.map(({ icon: Icon, label }) => (
                        <Badge key={label} variant="outline" className="text-[10px] gap-1 text-muted-foreground border-border/50">
                          <Icon className="h-2.5 w-2.5" />{label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {a.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{a.description}</p>}

                <div className="mt-auto pt-3 flex items-center gap-1 flex-wrap">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditing(a)}>
                    <Pencil className="h-3.5 w-3.5" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busyId === a.id} onClick={() => toggleShared(a)}>
                    {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
                    {a.shared ? 'Unshare' : 'Share'}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 gap-1 text-xs"
                    disabled={downloadingId === a.id}
                    title="Download signed bundle for the kotwal-agent CLI"
                    onClick={() => handleDownload(a)}
                  >
                    {downloadingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" className={cn('h-7 w-7 p-0 ml-auto text-muted-foreground hover:text-[hsl(var(--danger))]')}
                    disabled={busyId === a.id} onClick={() => remove(a)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AgentForm
        open={editing !== null}
        agent={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </div>
  );
}
