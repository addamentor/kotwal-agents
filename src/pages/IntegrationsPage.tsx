import { useCallback, useEffect, useState } from 'react';
import { Settings, Chrome, Cloud, CheckCircle2, XCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { OAuthConnectionInfo, listConnections, disconnectIntegration, getIntegrationAuthUrl } from '@/services/agentApi';

interface IntegrationState {
  gdrive:   { enabled: boolean; connection: OAuthConnectionInfo | null };
  onedrive: { enabled: boolean; connection: OAuthConnectionInfo | null };
}

export default function IntegrationsPage() {
  const [state, setState]     = useState<IntegrationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<'gdrive' | 'onedrive' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConnections();
      setState({
        gdrive: {
          enabled:    data.gdrive.enabled,
          connection: data.connections.find(c => c.provider === 'gdrive') ?? null,
        },
        onedrive: {
          enabled:    data.onedrive.enabled,
          connection: data.connections.find(c => c.provider === 'onedrive') ?? null,
        },
      });
    } catch (e) {
      toast({ title: 'Failed to load integrations', variant: 'destructive',
        description: e instanceof Error ? e.message : undefined });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleConnect = (provider: 'gdrive' | 'onedrive') => {
    const url = getIntegrationAuthUrl(provider);
    const popup = window.open(url, `connect-${provider}`,
      'width=600,height=700,scrollbars=yes');
    if (!popup) {
      toast({ title: 'Popup blocked', variant: 'destructive',
        description: 'Please allow popups for this site and try again.' });
      return;
    }
    // Poll until the popup closes, then reload connections.
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        void load();
      }
    }, 800);
  };

  const handleDisconnect = async (provider: 'gdrive' | 'onedrive') => {
    if (!window.confirm(`Disconnect ${provider === 'gdrive' ? 'Google Drive' : 'OneDrive'}? Any agent knowledge sources attached from this account will stop syncing.`)) return;
    setBusyId(provider);
    try {
      await disconnectIntegration(provider);
      await load();
      toast({ title: 'Disconnected successfully' });
    } catch (e) {
      toast({ title: 'Disconnect failed', variant: 'destructive',
        description: e instanceof Error ? e.message : undefined });
    } finally { setBusyId(null); }
  };

  const providers: Array<{
    key: 'gdrive' | 'onedrive';
    label: string;
    Icon: React.ElementType;
    docUrl: string;
  }> = [
    { key: 'gdrive',   label: 'Google Drive',  Icon: Chrome, docUrl: 'https://console.cloud.google.com' },
    { key: 'onedrive', label: 'OneDrive',       Icon: Cloud,  docUrl: 'https://portal.azure.com'  },
  ];

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Kotwal Agents</p>
        <h1 className="text-2xl font-semibold mt-1 flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />Integrations
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect cloud drives to use files from Google Drive or OneDrive as agent knowledge sources.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map(({ key, label, Icon }) => {
            const s = state?.[key];
            const conn = s?.connection ?? null;
            const enabled = s?.enabled ?? false;

            return (
              <div key={key} className="rounded-xl border border-border p-5 flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    {conn ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-600">
                        <CheckCircle2 className="h-2.5 w-2.5" />Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                        <XCircle className="h-2.5 w-2.5" />Not connected
                      </Badge>
                    )}
                  </div>

                  {conn ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {conn.accountEmail || 'Connected account'}
                    </p>
                  ) : !enabled ? (
                    <p className="text-xs text-amber-500 mt-0.5">
                      Not configured on this server. Set the {key.toUpperCase()}_CLIENT_ID / SECRET env vars.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connect to pick files from {label} as agent knowledge.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => void load()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  {conn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                      disabled={busyId === key}
                      onClick={() => void handleDisconnect(key)}
                    >
                      {busyId === key
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <XCircle className="h-3.5 w-3.5" />}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      disabled={!enabled}
                      onClick={() => handleConnect(key)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
