/**
 * BasicsStep — identity, persona, answer mode, model, sharing. The first step;
 * name is required before the wizard will persist a draft.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChatModelOption } from '@/services/agentApi';
import AnswerModeCards from './AnswerModeCards';
import { DraftFields } from './types';

const MEMORY_SNIPPET =
  '\nWhen you learn something worth remembering for future conversations, write <remember key="fact_name">value</remember> at the end of your reply. To forget a fact, use <remember key="fact_name"></remember>.';

export default function BasicsStep({ fields, setField, models }: {
  fields: DraftFields;
  setField: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
  models: ChatModelOption[];
}) {
  const addMemoryInstruction = () => {
    setField('instructions',
      fields.instructions.includes('<remember key=')
        ? fields.instructions
        : (fields.instructions.trim() ? fields.instructions.trim() + MEMORY_SNIPPET : MEMORY_SNIPPET.trim()));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <Input className="h-8 text-sm" value={fields.name} onChange={(e) => setField('name', e.target.value)} placeholder="Research Buddy" autoFocus />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Description (optional)</Label>
        <Input className="h-8 text-sm" value={fields.description} onChange={(e) => setField('description', e.target.value)} placeholder="What this agent is for" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Instructions / persona (optional)</Label>
          <button
            type="button"
            className="text-[10px] text-primary hover:underline flex items-center gap-1"
            title="Appends the remember-tag instruction so the agent knows how to save facts to long-term memory"
            onClick={addMemoryInstruction}
          >
            + Add memory instruction
          </button>
        </div>
        <Textarea className="text-sm min-h-[90px]" value={fields.instructions} onChange={(e) => setField('instructions', e.target.value)}
          placeholder="e.g. You are a concise research assistant. Cite sources and avoid speculation." />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">How should it answer?</Label>
        <AnswerModeCards value={fields.answerMode} onChange={(m) => setField('answerMode', m)} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Model</Label>
        <Select value={fields.modelId} onValueChange={(v) => setField('modelId', v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Let the user choose</SelectItem>
            {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.provider ? ` · ${m.provider}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <Switch checked={fields.shared} onCheckedChange={(v) => setField('shared', v)} />
        <span className="text-xs text-muted-foreground">Share with everyone in my organization (appears in the catalog)</span>
      </label>
    </div>
  );
}
