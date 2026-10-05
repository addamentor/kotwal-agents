/**
 * KnowledgeStep — attach files, URLs and Drive sources. Reuses KnowledgeSection
 * unchanged; it requires a persisted agent id, which the wizard guarantees by
 * creating an inactive draft before this step is reachable.
 */
import { Loader2 } from 'lucide-react';
import KnowledgeSection from '@/components/KnowledgeSection';
import { AnswerMode } from '@/services/agentApi';

export default function KnowledgeStep({ agentId, answerMode }: {
  agentId: string | null;
  answerMode: AnswerMode;
}) {
  if (!agentId) {
    return (
      <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />Preparing draft…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {answerMode === 'open' ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
          This agent uses <strong>Open assistant</strong> mode and will not read attached knowledge.
          Switch to “Only my sources” or “My sources + AI” on the Basics step to ground it in what you attach here.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {answerMode === 'strict'
            ? 'This agent answers strictly from these sources. Attach the documents it should rely on.'
            : 'This agent prefers these sources and falls back to the model. Attach what it should ground its answers in.'}
        </p>
      )}
      <KnowledgeSection agentId={agentId} />
    </div>
  );
}
