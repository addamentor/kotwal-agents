/**
 * AnswerModeCards — the answer-mode chooser as selectable cards (replaces the
 * bare dropdown). Values stay `strict | hybrid | open` so nothing downstream
 * changes; the cards just make the enforcement contract legible at creation time.
 */
import { Check, BookLock, Layers, Sparkles } from 'lucide-react';
import { AnswerMode } from '@/services/agentApi';
import { cn } from '@/lib/utils';
import { ANSWER_MODES } from './types';

const ICONS: Record<AnswerMode, typeof BookLock> = {
  strict: BookLock,
  hybrid: Layers,
  open: Sparkles,
};

export default function AnswerModeCards({ value, onChange }: {
  value: AnswerMode;
  onChange: (m: AnswerMode) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {ANSWER_MODES.map((m) => {
        const Icon = ICONS[m.value];
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            aria-pressed={active}
            className={cn(
              'relative rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:border-primary/40',
            )}
          >
            {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
            <Icon className={cn('h-4 w-4 mb-1.5', active ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-xs font-semibold">{m.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
