import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Agent, AgentInput, AnswerMode, ChatModelOption, createAgent, updateAgent, listChatModels } from '@/services/agentApi';

const ANSWER_MODES: { value: AnswerMode; label: string; hint: string }[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'Prefer any attached knowledge, fall back to the model and flag it.' },
  { value: 'strict', label: 'Strict', hint: 'Answer only from attached knowledge; say so if not found.' },
  { value: 'open',   label: 'Open',   hint: 'No knowledge grounding — a normal assistant with your instructions.' },
];

/**
 * Create / edit a user agent. `agent` null = create mode.
 * Note: this app creates user-scope agents without a workspace link (personal
 * assistants). Workspace-grounded agents are managed by PMs in the main app.
 */
export default function AgentForm({ agent, open, onClose, onSaved }: {
  agent: Agent | null;
  open: boolean;
  onClose: () => void;
  onSaved: (a: Agent) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [answerMode, setAnswerMode] = useState<AnswerMode>('hybrid');
  const [modelId, setModelId] = useState<string>('auto');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<ChatModelOption[]>([]);

  // Reset form each time the dialog opens for a given agent.
  useEffect(() => {
    if (!open) return;
    setName(agent?.name ?? '');
    setDescription(agent?.description ?? '');
    setInstructions(agent?.instructions ?? '');
    setAnswerMode(agent?.answerMode ?? 'hybrid');
    setModelId(agent?.modelId ?? 'auto');
    setShared(agent?.shared ?? false);
  }, [open, agent]);

  useEffect(() => { void listChatModels().then(setModels); }, []);

  const save = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const input: AgentInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
        answerMode,
        modelId: modelId === 'auto' ? null : modelId,
        shared,
      };
      const saved = agent ? await updateAgent(agent.id, input) : await createAgent(input);
      toast({ title: agent ? 'Agent updated' : 'Agent created' });
      onSaved(saved);
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit agent' : 'Create an agent'}</DialogTitle>
          <DialogDescription>Give your agent a persona and choose how it answers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input className="h-8 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Research Buddy" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Answer mode</Label>
              <Select value={answerMode} onValueChange={(v) => setAnswerMode(v as AnswerMode)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANSWER_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description (optional)</Label>
            <Input className="h-8 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this agent is for" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Instructions / persona (optional)</Label>
            <Textarea className="text-sm min-h-[90px]" value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. You are a concise research assistant. Cite sources and avoid speculation." />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Let the user choose</SelectItem>
                {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.provider ? ` · ${m.provider}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Switch checked={shared} onCheckedChange={setShared} />
            <span className="text-xs text-muted-foreground">Share with everyone in my organization (appears in the catalog)</span>
          </label>

          <p className="text-xs text-muted-foreground">{ANSWER_MODES.find((m) => m.value === answerMode)?.hint}</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{agent ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
