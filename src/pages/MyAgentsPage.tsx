import { LayoutGrid } from 'lucide-react';

/**
 * My Agents — CRUD for the user's own agents. Placeholder shell; the full
 * create/edit/share UI is built in the next step (Task 12).
 */
export default function MyAgentsPage() {
  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
        <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />My Agents
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create custom agents, give them instructions and knowledge, and share them with your team.
        </p>
      </header>
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Agent management is coming in the next step.
      </div>
    </div>
  );
}
