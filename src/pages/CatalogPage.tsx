import { Compass } from 'lucide-react';

/**
 * Shared Catalog — discoverable agents shared by other users in the tenant.
 * Placeholder shell; the searchable grid is built in the next step (Task 12).
 */
export default function CatalogPage() {
  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
        <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />Shared Catalog
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Discover agents your teammates have shared across your organization.
        </p>
      </header>
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        The shared catalog is coming in the next step.
      </div>
    </div>
  );
}
