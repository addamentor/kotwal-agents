import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Bot, Loader2, Search, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Agent, listSharedAgents } from '@/services/agentApi';

// Deep-link to the full chat app — used only as a secondary "open in full app" option.
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) || 'https://app.aikotwal.com';

export default function CatalogPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try { setAgents(await listSharedAgents(q)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load catalog'); }
    finally { setLoading(false); }
  }, []);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => void load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const useInChat = (a: Agent) => {
    navigate(`/agents/${a.id}/chat`);
  };

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

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="h-9 pl-8 text-sm" placeholder="Search agents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
      ) : error ? (
        <div className="py-8">
          <p className="text-sm text-[hsl(var(--danger))]">{error}</p>
          <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={() => load(search)}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Compass className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm text-muted-foreground">
            {search ? 'No agents match your search.' : 'No shared agents yet. Share one of yours to seed the catalog.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-4 flex flex-col">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0"><Bot className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                  <Badge variant="outline" className="mt-1 text-[10px] capitalize">{a.answerMode}</Badge>
                </div>
              </div>
              {a.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{a.description}</p>}
              <div className="mt-auto pt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => useInChat(a)}>
                  Chat<ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={`${APP_URL}/?agentId=${encodeURIComponent(a.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Open in full chat app"
                >
                  Full app ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
