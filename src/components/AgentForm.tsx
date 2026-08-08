import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronDown, ChevronUp, FolderOpen, Monitor, Terminal, Globe } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Agent, AgentInput, AnswerMode, ChatModelOption, ToolConfig, createAgent, updateAgent, listChatModels, emptyToolConfig } from '@/services/agentApi';
import { cn } from '@/lib/utils';

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
  const [toolConfig, setToolConfig] = useState<ToolConfig>(emptyToolConfig());
  const [capsOpen, setCapsOpen] = useState(false);
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
    setToolConfig(agent?.toolConfig ?? emptyToolConfig());
    setCapsOpen(false);
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
        toolConfig,
      };
      const saved = agent ? await updateAgent(agent.id, input) : await createAgent(input);
      toast({ title: agent ? 'Agent updated' : 'Agent created' });
      onSaved(saved);
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setSaving(false); }
  };

  const patchTool = (patch: Partial<ToolConfig>) =>
    setToolConfig((prev) => ({ ...prev, ...patch }));

  const activeCaps = [
    toolConfig.fileAccess?.enabled    && 'File access',
    toolConfig.screenCapture?.enabled && 'Screen capture',
    toolConfig.shellExec?.enabled     && 'Shell exec',
    toolConfig.webSearch              && 'Web search',
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* ── Capabilities (local tools for the CLI runtime) ── */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setCapsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>
                Local capabilities
                {activeCaps.length > 0 && (
                  <span className="ml-2 text-primary">{activeCaps.join(', ')}</span>
                )}
              </span>
              {capsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {capsOpen && (
              <div className="border-t border-border px-3 py-3 space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  These capabilities are used by the <strong>kotwal-agent CLI</strong> when a user
                  runs this agent locally. They let the agent read files, capture the screen, or
                  run shell commands on the user's machine. All output still passes through
                  Kotwal's detection engine before reaching the model.
                </p>

                {/* File access */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={toolConfig.fileAccess?.enabled ?? false}
                      onCheckedChange={(v) => patchTool({ fileAccess: { ...toolConfig.fileAccess, enabled: v } })}
                    />
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">File access</span>
                  </label>
                  {toolConfig.fileAccess?.enabled && (
                    <div className="ml-8 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Allowed paths (one per line)</Label>
                      <Textarea
                        className="text-xs min-h-[60px] font-mono"
                        value={(toolConfig.fileAccess.allowedPaths ?? []).join('\n')}
                        onChange={(e) => patchTool({
                          fileAccess: {
                            ...toolConfig.fileAccess,
                            allowedPaths: e.target.value.split('\n').map(p => p.trim()).filter(Boolean),
                          },
                        })}
                        placeholder="~/Documents&#10;./data"
                      />
                      <p className="text-[10px] text-muted-foreground">The agent can only read/write within these directories.</p>
                    </div>
                  )}
                </div>

                {/* Screen capture */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={toolConfig.screenCapture?.enabled ?? false}
                    onCheckedChange={(v) => patchTool({ screenCapture: { enabled: v } })}
                  />
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Screen capture</span>
                  <span className="text-muted-foreground ml-1">— agent can take a screenshot of the user's primary display</span>
                </label>

                {/* Shell exec */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={toolConfig.shellExec?.enabled ?? false}
                      onCheckedChange={(v) => patchTool({ shellExec: { ...toolConfig.shellExec, enabled: v } })}
                    />
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Shell execution</span>
                    <span className={cn('ml-1 font-semibold', toolConfig.shellExec?.enabled ? 'text-amber-500' : 'text-muted-foreground')}>
                      {toolConfig.shellExec?.enabled ? '⚠ Advanced' : '— advanced, off by default'}
                    </span>
                  </label>
                  {toolConfig.shellExec?.enabled && (
                    <div className="ml-8 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Allowed commands (one per line, plain names only — no paths)</Label>
                      <Textarea
                        className="text-xs min-h-[60px] font-mono"
                        value={(toolConfig.shellExec.allowedCommands ?? []).join('\n')}
                        onChange={(e) => patchTool({
                          shellExec: {
                            ...toolConfig.shellExec,
                            allowedCommands: e.target.value.split('\n').map(c => c.trim()).filter(Boolean),
                          },
                        })}
                        placeholder="git&#10;npm&#10;python3"
                      />
                      <p className="text-[10px] text-amber-500">Only these exact command names can be run. Arguments are passed safely without shell interpolation.</p>
                    </div>
                  )}
                </div>

                {/* Web search */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={toolConfig.webSearch ?? false}
                    onCheckedChange={(v) => patchTool({ webSearch: v })}
                  />
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Web search</span>
                  <span className="text-muted-foreground ml-1">— agent may search the internet (requires web search to be enabled for your tenant)</span>
                </label>
              </div>
            )}
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
