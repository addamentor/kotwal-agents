import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Trash2, RefreshCw, Loader2, Link, Upload, CheckCircle2, XCircle, Clock, AlertCircle, Cloud, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  AgentKnowledgeSource, KnowledgeSourceStatus, DriveFile, OAuthConnectionInfo,
  listKnowledgeSources, addKnowledgeUrl, addKnowledgeFile, addKnowledgeDriveFile,
  reindexKnowledgeSource, deleteKnowledgeSource,
  listConnections,
} from '@/services/agentApi';
import DriveFilePicker from '@/components/DriveFilePicker';

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: KnowledgeSourceStatus }) {
  switch (status) {
    case 'indexed':  return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
    case 'error':    return <XCircle      className="h-3 w-3 text-destructive shrink-0" />;
    case 'stale':    return <AlertCircle  className="h-3 w-3 text-amber-500 shrink-0" />;
    default:         return <Clock        className="h-3 w-3 text-muted-foreground shrink-0 animate-pulse" />;
  }
}

function statusLabel(s: KnowledgeSourceStatus): string {
  return s === 'indexed' ? 'ready' : s;
}

function fmtBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1048576).toFixed(1)}MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  agentId: string;
}

export default function KnowledgeSection({ agentId }: Props) {
  const [sources, setSources]     = useState<AgentKnowledgeSource[]>([]);
  const [loading, setLoading]     = useState(true);
  const [urlInput, setUrlInput]   = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [busyId, setBusyId]       = useState<string | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  // Drive integration state
  const [gdriveConn, setGdriveConn]     = useState<OAuthConnectionInfo | null>(null);
  const [onedriveConn, setOnedriveConn] = useState<OAuthConnectionInfo | null>(null);
  const [pickerOpen, setPickerOpen]     = useState<'gdrive' | 'onedrive' | null>(null);
  const [addingDrive, setAddingDrive]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [srcs, intData] = await Promise.all([
        listKnowledgeSources(agentId),
        listConnections().catch(() => null),
      ]);
      setSources(srcs);
      if (intData) {
        setGdriveConn(intData.connections.find(c => c.provider === 'gdrive') ?? null);
        setOnedriveConn(intData.connections.find(c => c.provider === 'onedrive') ?? null);
      }
    } catch (e) {
      toast({ title: 'Failed to load sources', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);

  const handleAddUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setAddingUrl(true);
    try {
      const src = await addKnowledgeUrl(agentId, { type: 'web', url });
      setSources(prev => [src, ...prev]);
      setUrlInput('');
      toast({ title: 'Source added', description: 'Indexing started — status will update shortly.' });
    } catch (e) {
      toast({ title: 'Failed to add URL', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setAddingUrl(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingFile(true);
    try {
      const src = await addKnowledgeFile(agentId, file);
      setSources(prev => [src, ...prev]);
      toast({ title: 'File uploaded', description: 'Indexing started.' });
    } catch (e) {
      toast({ title: 'Upload failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setUploadingFile(false); }
  };

  const handlePickDriveFile = async (provider: 'gdrive' | 'onedrive', file: DriveFile) => {
    setAddingDrive(true);
    try {
      const src = await addKnowledgeDriveFile(agentId, provider, file);
      setSources(prev => [src, ...prev]);
      toast({ title: 'Drive file added', description: 'Indexing started.' });
    } catch (e) {
      toast({ title: 'Failed to add file', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setAddingDrive(false); }
  };

  const handleReindex = async (src: AgentKnowledgeSource) => {
    setBusyId(src.id);
    try {
      await reindexKnowledgeSource(agentId, src.id);
      setSources(prev => prev.map(s => s.id === src.id ? { ...s, status: 'pending' } : s));
      toast({ title: 'Re-index triggered' });
    } catch (e) {
      toast({ title: 'Reindex failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); }
  };

  const handleDelete = async (src: AgentKnowledgeSource) => {
    if (!window.confirm(`Remove "${src.title || src.url || 'this source'}"?`)) return;
    setBusyId(src.id);
    try {
      await deleteKnowledgeSource(agentId, src.id);
      setSources(prev => prev.filter(s => s.id !== src.id));
    } catch (e) {
      toast({ title: 'Delete failed', variant: 'destructive', description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        Knowledge sources
        {sources.length > 0 && (
          <Badge variant="outline" className="text-[10px] ml-1">{sources.length}</Badge>
        )}
      </div>

      {/* Add URL */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-8 font-mono"
            placeholder="https://docs.example.com/page"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAddUrl(); } }}
            disabled={addingUrl}
          />
        </div>
        <Button size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={() => void handleAddUrl()} disabled={addingUrl || !urlInput.trim()}>
          {addingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add URL
        </Button>
      </div>

      {/* File upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt,.md,.pdf,.html,.csv,.docx,.doc"
          onChange={e => void handleFileChange(e)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
        >
          {uploadingFile
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Upload className="h-3.5 w-3.5" />}
          Upload file (PDF, TXT, MD, DOCX, CSV, HTML)
        </Button>
      </div>

      {/* Drive pickers */}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs flex-1"
          disabled={addingDrive || !gdriveConn}
          title={gdriveConn ? 'Pick a file from Google Drive' : 'Connect Google Drive in Settings → Integrations'}
          onClick={() => setPickerOpen('gdrive')}
        >
          <Chrome className="h-3.5 w-3.5" />
          {gdriveConn ? 'From Google Drive' : 'Google Drive (not connected)'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs flex-1"
          disabled={addingDrive || !onedriveConn}
          title={onedriveConn ? 'Pick a file from OneDrive' : 'Connect OneDrive in Settings → Integrations'}
          onClick={() => setPickerOpen('onedrive')}
        >
          <Cloud className="h-3.5 w-3.5" />
          {onedriveConn ? 'From OneDrive' : 'OneDrive (not connected)'}
        </Button>
      </div>

      {/* Drive picker modals */}
      <DriveFilePicker
        open={pickerOpen === 'gdrive'}
        provider="gdrive"
        connection={gdriveConn}
        onClose={() => setPickerOpen(null)}
        onPick={f => void handlePickDriveFile('gdrive', f)}
      />
      <DriveFilePicker
        open={pickerOpen === 'onedrive'}
        provider="onedrive"
        connection={onedriveConn}
        onClose={() => setPickerOpen(null)}
        onPick={f => void handlePickDriveFile('onedrive', f)}
      />

      {/* Source list */}
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />Loading sources…
        </div>
      ) : sources.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No knowledge sources yet. Add a URL or upload a file to ground this agent's answers.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sources.map(src => (
            <li key={src.id} className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-2">
              <StatusIcon status={src.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{src.title || src.url || 'Uploaded file'}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={cn('text-[10px]',
                    src.status === 'indexed' ? 'text-green-600' :
                    src.status === 'error' ? 'text-destructive' :
                    'text-muted-foreground'
                  )}>{statusLabel(src.status)}</span>
                  {src.chunkCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">{src.chunkCount} chunks</span>
                  )}
                  {src.bytesIndexed && (
                    <span className="text-[10px] text-muted-foreground">{fmtBytes(src.bytesIndexed)}</span>
                  )}
                </div>
                {src.status === 'error' && src.lastError && (
                  <p className="text-[10px] text-destructive mt-0.5 truncate">{src.lastError}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                  title="Re-index" disabled={busyId === src.id}
                  onClick={() => void handleReindex(src)}
                >
                  {busyId === src.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  title="Delete" disabled={busyId === src.id}
                  onClick={() => void handleDelete(src)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
