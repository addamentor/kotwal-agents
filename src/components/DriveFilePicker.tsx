import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, FileText, RefreshCw, Cloud, Chrome, Folder, FolderPlus, ChevronRight, Home } from 'lucide-react';
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

interface Crumb { id: string; name: string; }

interface Props {
  open: boolean;
  provider: 'gdrive' | 'onedrive';
  connection: OAuthConnectionInfo | null;
  onClose: () => void;
  onPick: (file: DriveFile) => void;
  /** When provided, folders can be attached whole (enables "Use this folder"). */
  onPickFolder?: (folder: { id: string; name: string }) => void;
}

export default function DriveFilePicker({ open, provider, connection, onClose, onPick, onPickFolder }: Props) {
  const [files, setFiles]     = useState<DriveFile[]>([]);
  const [query, setQuery]     = useState('');
  const [path, setPath]       = useState<Crumb[]>([]);   // folder navigation stack
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const label = provider === 'gdrive' ? 'Google Drive' : 'OneDrive';
  const Icon  = provider === 'gdrive' ? Chrome : Cloud;
  const current = path.length ? path[path.length - 1] : null;

  // At the top level Drive needs the 'root' alias; Graph lists root children when
  // no parentId is given. Inside a folder both use the folder's id.
  const parentId = current ? current.id : (provider === 'gdrive' ? 'root' : undefined);

  const load = useCallback(async (q: string, pid: string | undefined) => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      // Search is global (parentId ignored server-side); browsing uses parentId.
      const data = await listDriveFiles(provider, {
        query: q,
        pageSize: 100,
        includeFolders: true,
        ...(q.trim() ? {} : { parentId: pid }),
      });
      // Folders first, then files — stable within each group.
      const sorted = [...data.files].sort((a, b) => Number(!!b.isFolder) - Number(!!a.isFolder));
      setFiles(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files.');
    } finally { setLoading(false); }
  }, [connection, provider]);

  // Debounced reload on query / folder change.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(query, parentId), 300);
    return () => clearTimeout(t);
  }, [query, parentId, open, load]);

  // Reset navigation whenever the picker (re)opens.
  useEffect(() => {
    if (open) { setQuery(''); setFiles([]); setError(null); setPath([]); }
  }, [open]);

  const enterFolder = (f: DriveFile) => { setQuery(''); setPath(prev => [...prev, { id: f.id, name: f.name }]); };
  const goToCrumb   = (idx: number) => { setQuery(''); setPath(prev => prev.slice(0, idx + 1)); };
  const goHome      = () => { setQuery(''); setPath([]); };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {onPickFolder ? `Pick a file or folder from ${label}` : `Pick a file from ${label}`}
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

            {/* Breadcrumbs + "Use this folder" */}
            {!query.trim() && (
              <div className="flex items-center justify-between gap-2 shrink-0 min-h-[28px]">
                <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground min-w-0 overflow-x-auto">
                  <button type="button" className="flex items-center gap-1 hover:text-foreground shrink-0" onClick={goHome}>
                    <Home className="h-3 w-3" />Home
                  </button>
                  {path.map((c, i) => (
                    <span key={c.id} className="flex items-center gap-0.5 min-w-0">
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <button
                        type="button"
                        className="truncate max-w-[120px] hover:text-foreground"
                        onClick={() => goToCrumb(i)}
                      >{c.name}</button>
                    </span>
                  ))}
                </div>
                {onPickFolder && current && (
                  <Button
                    size="sm" className="h-6 gap-1 text-[11px] shrink-0"
                    onClick={() => { onPickFolder({ id: current.id, name: current.name }); onClose(); }}
                  >
                    <FolderPlus className="h-3 w-3" />Use this folder
                  </Button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading…
                </div>
              ) : error ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button size="sm" variant="ghost" className="mt-2 gap-1.5" onClick={() => void load(query, parentId)}>
                    <RefreshCw className="h-3.5 w-3.5" />Retry
                  </Button>
                </div>
              ) : files.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">This folder is empty.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {files.map(f => (
                    <li key={f.id} className="flex items-center">
                      <button
                        type="button"
                        className="flex-1 flex items-start gap-3 px-2 py-2.5 hover:bg-accent/50 transition-colors text-left min-w-0"
                        onClick={() => { if (f.isFolder) enterFolder(f); else { onPick(f); onClose(); } }}
                      >
                        {f.isFolder
                          ? <Folder className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          : <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            {fmtDate(f.modifiedTime) && <span>{fmtDate(f.modifiedTime)}</span>}
                            {fmtSize(f.size) && <span>{fmtSize(f.size)}</span>}
                            {f.isFolder && <span>folder</span>}
                          </div>
                        </div>
                      </button>
                      {onPickFolder && f.isFolder && (
                        <Button
                          size="sm" variant="ghost" className="h-6 gap-1 text-[11px] mr-1 shrink-0"
                          title="Attach this whole folder"
                          onClick={() => { onPickFolder({ id: f.id, name: f.name }); onClose(); }}
                        >
                          <FolderPlus className="h-3 w-3" />Use
                        </Button>
                      )}
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
