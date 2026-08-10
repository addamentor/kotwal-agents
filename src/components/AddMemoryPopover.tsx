import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { addAgentMemory } from '@/services/agentApi';

interface Props {
  agentId: string;
  onSaved?: () => void;
  /** Compact = icon-only trigger (for chat header). Default = labelled button. */
  compact?: boolean;
}

export default function AddMemoryPopover({ agentId, onSaved, compact }: Props) {
  const [open, setOpen]     = useState(false);
  const [key, setKey]       = useState('');
  const [value, setValue]   = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setKey(''); setValue(''); setOpen(false); };

  const handleSave = async () => {
    const k = key.trim();
    const v = value.trim();
    if (!k) { toast({ title: 'Key is required', variant: 'destructive' }); return; }
    if (!v) { toast({ title: 'Value is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await addAgentMemory(agentId, k, v);
      toast({ title: `Remembered "${k}"` });
      reset();
      onSaved?.();
    } catch (e) {
      toast({ title: 'Failed to save', variant: 'destructive',
        description: e instanceof Error ? e.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant={compact ? 'ghost' : 'outline'}
        className={compact ? 'h-7 w-7 p-0 text-muted-foreground' : 'h-7 gap-1.5 text-xs'}
        title="Add a memory fact"
        onClick={() => setOpen(v => !v)}
      >
        <Plus className="h-3.5 w-3.5" />
        {!compact && 'Add fact'}
      </Button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div className="fixed inset-0 z-40" onClick={reset} />
          <div className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-border bg-background shadow-lg p-4 space-y-3">
            <p className="text-xs font-semibold">Add a memory fact</p>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Key (e.g. preferred_language)</Label>
              <Input
                className="h-7 text-xs font-mono"
                placeholder="fact_name"
                value={key}
                onChange={e => setKey(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Value</Label>
              <Input
                className="h-7 text-xs"
                placeholder="TypeScript"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSave(); }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={reset}>Cancel</Button>
              <Button size="sm" className="h-6 text-xs gap-1" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}Save
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
