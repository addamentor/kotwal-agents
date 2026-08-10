import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Pencil, MessageSquare, Loader2, RefreshCw, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  AgentTeam, AgentTeamInput, TeamMember,
  listAgentTeams, createAgentTeam, updateAgentTeam, deleteAgentTeam,
  Agent, listOwnAgents, listSharedAgents, ChatModelOption, listChatModels,
} from '@/services/agentApi';

// ── Team form dialog ──────────────────────────────────────────────────────────

function TeamForm({ team, open, onClose, onSaved }: {
  team: AgentTeam | null; open: boolean;
  onClose: () => void; onSaved: (t: AgentTeam) => void;
}) {
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [coordId, setCoordId]   = useState('');
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [agents, setAgents]     = useState<Agent[]>([]);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? '');
    setDesc(team?.description ?? '');
    setCoordId(team?.coordinatorAgentId ?? '');
    setMembers(team?.members ?? []);
    Promise.all([listOwnAgents(), listSharedAgents()])
      .then(([own, shared]) => {
        const by: Record<string, Agent> = {};
        for (const a of [...own, ...shared]) by[a.id] = a;
        setAgents(Object.values(by));
      }).catch(() => {});
  }, [open, team]);

  const addMember = () => {
    const available = agents.filter(a => a.id !== coordId && !members.find(m => m.agentId === a.id));
    if (!available.length) { toast({ title: 'No more agents to add', variant: 'destructive' }); return; }
    setMembers(prev => [...prev, { agentId: available[0].id, name: available[0].name, routingHint: '' }]);
  };

  const removeMember = (idx: number) => setMembers(prev => prev.filter((_, i) => i !== idx));

  const patchMember = (idx: number, patch: Partial<TeamMember>) =>
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));

  const save = async () => {
    if (!name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    if (!coordId)     { toast({ title: 'Coordinator required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const input: AgentTeamInput = { name: name.trim(), description: desc.trim() || undefined, coordinatorAgentId: coordId, members };
      const saved = team ? await updateAgentTeam(team.id, input) : await createAgentTeam(input);
      toast({ title: team ? 'Team updated' : 'Team created' });
      onSaved(saved);
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team ? 'Edit team' : 'Create a team'}</DialogTitle>
          <DialogDescription>A coordinator agent routes tasks to specialist agents.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Team name</Label>
            <Input className="h-8 text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Research Team" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description (optional)</Label>
            <Input className="h-8 text-sm" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What this team is for" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Coordinator agent</Label>
            <Select value={coordId} onValueChange={setCoordId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select coordinator…" /></SelectTrigger>
              <SelectContent>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Receives every user message and routes sub-tasks to specialists.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Specialists</Label>
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={addMember}><Plus className="h-3 w-3" />Add</Button>
            </div>
            {members.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No specialists yet. The coordinator will handle everything itself.</p>
            )}
            {members.map((m, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={m.agentId} onValueChange={v => {
                    const agent = agents.find(a => a.id === v);
                    patchMember(i, { agentId: v, name: agent?.name ?? v });
                  }}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {agents.filter(a => a.id !== coordId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeMember(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">When to use (routing hint)</Label>
                  <Input className="h-7 text-xs" value={m.routingHint} onChange={e => patchMember(i, { routingHint: e.target.value })}
                    placeholder="e.g. data analysis, SQL queries" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{team ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AgentTeamsPage() {
  const navigate = useNavigate();
  const [teams, setTeams]     = useState<AgentTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgentTeam | 'new' | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTeams(await listAgentTeams()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load teams.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onSaved = (t: AgentTeam) => {
    setEditing(null);
    setTeams(prev => {
      const i = prev.findIndex(x => x.id === t.id);
      if (i === -1) return [t, ...prev];
      const copy = [...prev]; copy[i] = t; return copy;
    });
  };

  const remove = async (t: AgentTeam) => {
    if (!window.confirm(`Delete team "${t.name}"?`)) return;
    setBusyId(t.id);
    try {
      await deleteAgentTeam(t.id);
      setTeams(prev => prev.filter(x => x.id !== t.id));
    } catch (e) {
      toast({ title: 'Delete failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); }
  };

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />Agent Teams
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Group agents into teams — a coordinator routes tasks to specialist agents automatically.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />New team</Button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : error ? (
        <div className="py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Users className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm text-muted-foreground">No teams yet. Create a team to coordinate multiple agents.</p>
          <Button className="mt-4 gap-1.5" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />New team</Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map(t => (
            <li key={t.id} className="rounded-xl border border-border p-4 flex flex-col">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0"><Users className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{t.members.length} specialist{t.members.length !== 1 ? 's' : ''}</Badge>
                  </div>
                </div>
              </div>
              {t.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
              <div className="mt-auto pt-3 flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => navigate(`/teams/${t.id}/chat`)}>
                  <MessageSquare className="h-3.5 w-3.5" />Chat
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Button>
                <Button size="sm" variant="ghost"
                  className="h-7 w-7 p-0 ml-auto text-muted-foreground hover:text-destructive"
                  disabled={busyId === t.id} onClick={() => void remove(t)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TeamForm open={editing !== null}
        team={editing === 'new' ? null : (editing as AgentTeam | null)}
        onClose={() => setEditing(null)} onSaved={onSaved} />
    </div>
  );
}
