import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, FileText, RefreshCw, Cloud, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DriveFile, listDriveFiles, OAuthConnectionInfo } from '@/services/agentApi';

function fmtSize(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1048576).toFixed(1)}MB`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  open: boolean;
  provider: 'gdrive' | 'onedrive';
  connection: OAuthConnectionInfo | null;
  onClose: () => void;
  onPick: (file: DriveFile) => void;
}

export default function DriveFilePicker({ open, provider, connection, onClose, onPick }: Props) {
  const [files, setFiles]   = useState<DriveFile[]>([]);
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const label = provider === 'gdrive' ? 'Google Drive' : 'OneDrive';
  const Icon  = provider === 'gdrive' ? Chrome : Cloud;

  const load = useCallback(async (q: string) => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listDriveFiles(provider, { query: q, pageSize: 50 });
      setFiles(data.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files.');
    } finally { setLoading(false); }
  }, [connection, provider]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(query), 300);
    return () => clearTimeout(t);
  }, [query, open, load]);

  useEffect(() => {
    if (open) { setQuery(''); setFiles([]); setError(null); void load(''); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />Pick a file from {label}
          </DialogTitle>
        </DialogHeader>

        {!connection ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {label} is not connected. Go to <strong>Settings → Integrations</strong> to connect.
          </div>
        ) : (
          <>
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-sm"
                placeholder="Search files…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading…
                </div>
              ) : error ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={() => void load(query)}>
                    <RefreshCw className="h-3.5 w-3.5" />Retry
                  </Button>
                </div>
              ) : files.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No files found.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {files.map(f => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="w-full flex items-start gap-3 px-2 py-2.5 hover:bg-accent/50 transition-colors text-left"
                        onClick={() => { onPick(f); onClose(); }}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            {fmtDate(f.modifiedTime) && <span>{fmtDate(f.modifiedTime)}</span>}
                            {fmtSize(f.size) && <span>{fmtSize(f.size)}</span>}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
