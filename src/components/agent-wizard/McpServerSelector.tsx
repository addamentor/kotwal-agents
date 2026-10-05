/**
 * McpServerSelector — choose which registered MCP servers this agent may call.
 * Binds to toolConfig.mcpServerIds. Servers are managed elsewhere (Settings →
 * MCP); this only selects among the ones already available to the caller
 * (own or shared), so it never mutates server rows.
 */
import { useEffect, useState } from 'react';
import { Loader2, Server } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { McpServerSummary, listMcpServers } from '@/services/agentApi';

export default function McpServerSelector({ selectedIds, onChange }: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [servers, setServers] = useState<McpServerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listMcpServers()
      .then((s) => { if (alive) { setServers(s); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load MCP servers.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  // Any selected id that is no longer available (server removed / access revoked)
  // is preserved silently so saving the agent doesn't drop it — but surfaced so
  // the creator knows it's dangling.
  const orphanCount = selectedIds.filter((id) => !servers.some((s) => s.id === id)).length;

  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground leading-relaxed">
        Let this agent call tools from your registered MCP servers. Manage servers under
        <strong> Settings → MCP</strong>. Every tool call still passes through Kotwal's detection engine.
      </p>

      {loading ? (
        <div className="flex items-center gap-1.5 text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />Loading servers…
        </div>
      ) : error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : servers.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No MCP servers registered yet. Add one under Settings → MCP to make it selectable here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {servers.map((s) => (
            <li key={s.id} className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-2">
              <Server className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate flex items-center gap-1.5">
                  {s.name}
                  {s.shared && <Badge variant="outline" className="text-[9px]">shared</Badge>}
                  {s.status && s.status !== 'connected' && (
                    <span className="text-[10px] text-amber-500">{s.status}</span>
                  )}
                </p>
                {s.description && <p className="text-[10px] text-muted-foreground truncate">{s.description}</p>}
              </div>
              <Switch
                className="mt-0.5 shrink-0"
                checked={selectedIds.includes(s.id)}
                onCheckedChange={() => toggle(s.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {orphanCount > 0 && (
        <p className="text-[10px] text-amber-500">
          {orphanCount} previously selected server{orphanCount > 1 ? 's are' : ' is'} no longer available to you — kept on save but not shown above.
        </p>
      )}
    </div>
  );
}
