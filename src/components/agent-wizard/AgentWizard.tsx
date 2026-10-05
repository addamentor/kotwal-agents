/**
 * AgentWizard — staged create/edit flow: Basics → Knowledge → Advanced → Review.
 *
 * Drop-in replacement for AgentForm (same props). The draft lifecycle lives in
 * useAgentDraft; each step is a focused component. Knowledge attaches against a
 * real (inactive) draft the wizard persists when the user leaves Basics, so the
 * existing KnowledgeSection works unchanged.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Agent, ChatModelOption, listChatModels } from '@/services/agentApi';
import { useAgentDraft } from './useAgentDraft';
import { validateDraft } from './types';
import BasicsStep from './BasicsStep';
import KnowledgeStep from './KnowledgeStep';
import AdvancedStep from './AdvancedStep';
import ReviewStep from './ReviewStep';

const STEPS = ['Basics', 'Knowledge', 'Advanced', 'Review'] as const;
type StepIndex = 0 | 1 | 2 | 3;

export default function AgentWizard({ agent, open, onClose, onSaved }: {
  agent: Agent | null;
  open: boolean;
  onClose: () => void;
  onSaved: (a: Agent) => void;
}) {
  const draft = useAgentDraft(agent, open);
  const [step, setStep] = useState<StepIndex>(0);
  const [advancing, setAdvancing] = useState(false);
  const [models, setModels] = useState<ChatModelOption[]>([]);

  useEffect(() => { void listChatModels().then(setModels); }, []);
  useEffect(() => { if (open) setStep(0); }, [open]);

  const isEdit = !!agent;
  const errorMsg = useMemo(() => validateDraft(draft.fields), [draft.fields]);

  const goNext = async () => {
    // Leaving Basics for the first time persists an inactive draft so the
    // Knowledge step has an agent id to attach to.
    if (step === 0) {
      if (errorMsg) { toast({ title: errorMsg, variant: 'destructive' }); return; }
      setAdvancing(true);
      try {
        await draft.ensureDraft();
      } catch (e) {
        toast({ title: 'Could not start the draft', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
        return;
      } finally { setAdvancing(false); }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1) as StepIndex);
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0) as StepIndex);

  const finish = async () => {
    if (errorMsg) { toast({ title: errorMsg, variant: 'destructive' }); return; }
    try {
      const saved = await draft.finalize();
      toast({ title: isEdit ? 'Agent updated' : 'Agent created' });
      onSaved(saved);
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleCancel = async () => {
    if (draft.createdDraft) {
      if (window.confirm('Discard this draft agent? Any knowledge you attached will be removed.')) {
        try { await draft.discardIfUnfinished(); }
        catch (e) { toast({ title: 'Could not discard draft', variant: 'destructive', description: e instanceof Error ? e.message : undefined }); }
      }
    }
    onClose();
  };

  const busy = draft.saving || advancing;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) void handleCancel(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit agent' : 'Create an agent'}</DialogTitle>
          <DialogDescription>Give your agent a persona, ground it in your sources, and choose how it answers.</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-1.5 py-1">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-1.5">
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  active ? 'bg-primary text-primary-foreground'
                    : done ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={cn('text-[11px]', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
                {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-4 bg-border" />}
              </li>
            );
          })}
        </ol>

        <div className="py-1">
          {step === 0 && <BasicsStep fields={draft.fields} setField={draft.setField} models={models} />}
          {step === 1 && <KnowledgeStep agentId={draft.agentId} answerMode={draft.fields.answerMode} />}
          {step === 2 && <AdvancedStep fields={draft.fields} setField={draft.setField} hasProxySecret={agent?.hasProxySecret} />}
          {step === 3 && <ReviewStep fields={draft.fields} models={models} />}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            {step > 0 && <Button size="sm" variant="ghost" onClick={goBack} disabled={busy}>Back</Button>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => void handleCancel()} disabled={busy}>Cancel</Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" className="gap-1.5" onClick={() => void goNext()} disabled={busy || (step === 0 && !!errorMsg)}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Next
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => void finish()} disabled={busy || !!errorMsg}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{isEdit ? 'Save changes' : 'Create agent'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
