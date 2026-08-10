import { useCallback, useEffect, useState } from 'react';
import { Store, Bot, Loader2, Search, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { MarketplaceListing, listMarketplace, installMarketplaceAgent } from '@/services/agentApi';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MarketplacePage() {
  const [listings, setListings]   = useState<MarketplaceListing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setListings(await listMarketplace({ search: q, limit: 60 }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketplace.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleInstall = async (listing: MarketplaceListing) => {
    setInstallingId(listing.id);
    try {
      await installMarketplaceAgent(listing.id);
      setInstalled(prev => new Set([...prev, listing.id]));
      toast({ title: `"${listing.name}" installed`, description: 'Find it in My Agents.' });
    } catch (e) {
      toast({ title: 'Install failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setInstallingId(null); }
  };

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
        <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />Marketplace
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Discover and install agents published by the community.
        </p>
      </header>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="h-9 pl-8 text-sm" placeholder="Search agents…" value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />Loading…
        </div>
      ) : error ? (
        <div className="py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={() => void load(search)}>
            <RefreshCw className="h-3.5 w-3.5" />Retry
          </Button>
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Store className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-2 text-sm text-muted-foreground">
            {search ? 'No agents match your search.' : 'No agents in the marketplace yet.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map(l => (
            <li key={l.id} className="rounded-xl border border-border p-4 flex flex-col">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{l.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">{l.answerMode}</Badge>
                    <Badge variant="outline" className="text-[10px]">v{l.version}</Badge>
                    {l.marketplaceTags?.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              {l.description && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{l.description}</p>
              )}
              {l.publishedAt && (
                <p className="mt-1 text-[10px] text-muted-foreground">Published {fmtDate(l.publishedAt)}</p>
              )}
              <div className="mt-auto pt-3">
                <Button
                  size="sm"
                  variant={installed.has(l.id) ? 'outline' : 'default'}
                  className="h-7 gap-1 text-xs w-full"
                  disabled={installingId === l.id || installed.has(l.id)}
                  onClick={() => void handleInstall(l)}
                >
                  {installingId === l.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : installed.has(l.id) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {installed.has(l.id) ? 'Installed' : 'Install'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
