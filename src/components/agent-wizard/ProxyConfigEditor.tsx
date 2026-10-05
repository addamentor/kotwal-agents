/**
 * ProxyConfigEditor — configure an agent as a 3rd-party proxy (route every
 * message through an external endpoint). Extracted from the original AgentForm.
 * Operates on the wizard draft fields it needs, via a typed patch callback.
 *
 * The "ground this proxy with attached knowledge" toggle drives
 * toolConfig.groundProxy, which the backend enforces before forwarding (Step 5):
 * with "Only my sources", an off-topic prompt is refused Kotwal-side and the
 * external endpoint is never called. It lives on toolConfig (not a proxy column),
 * so it's passed/patched separately from the proxy fields.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentType, ProxyAuthType } from '@/services/agentApi';

export interface ProxyFields {
  agentType: AgentType;
  proxyUrl: string;
  proxyAuthType: ProxyAuthType;
  proxyAuthHeader: string;
  proxyAuthSecret: string;
  proxyResponsePath: string;
}

export default function ProxyConfigEditor({ value, hasProxySecret, groundProxy, onGroundProxyChange, onPatch }: {
  value: ProxyFields;
  /** True when editing an agent that already has a stored secret. */
  hasProxySecret?: boolean;
  /** toolConfig.groundProxy — grounding/answer-mode enforcement before forwarding. */
  groundProxy?: boolean;
  onGroundProxyChange?: (v: boolean) => void;
  onPatch: (patch: Partial<ProxyFields>) => void;
}) {
  const isProxy = value.agentType === 'proxy';

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground leading-relaxed">
        Route every message through an external agent endpoint. All prompts and
        responses still pass through Kotwal's detection engine.
      </p>

      <div className="flex items-center gap-2">
        <Switch
          checked={isProxy}
          onCheckedChange={(v) => onPatch({ agentType: v ? 'proxy' : 'kotwal' })}
        />
        <span className="font-medium">Enable proxy mode</span>
      </div>

      {isProxy && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Proxy URL (HTTPS required in production)</Label>
            <Input
              className="h-8 text-xs font-mono"
              value={value.proxyUrl}
              onChange={(e) => onPatch({ proxyUrl: e.target.value })}
              placeholder="https://api.example.com/v1/chat"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Auth type</Label>
            <Select value={value.proxyAuthType} onValueChange={(v) => onPatch({ proxyAuthType: v as ProxyAuthType })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bearer">Bearer token</SelectItem>
                <SelectItem value="header">Custom header</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value.proxyAuthType === 'header' && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Header name (e.g. X-Api-Key)</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={value.proxyAuthHeader}
                onChange={(e) => onPatch({ proxyAuthHeader: e.target.value })}
                placeholder="X-Api-Key"
              />
            </div>
          )}

          {(value.proxyAuthType === 'bearer' || value.proxyAuthType === 'header') && (
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Secret / token
                {hasProxySecret && <span className="ml-1 text-primary">(already set — leave blank to keep)</span>}
              </Label>
              <Input
                className="h-8 text-xs font-mono"
                type="password"
                value={value.proxyAuthSecret}
                onChange={(e) => onPatch({ proxyAuthSecret: e.target.value })}
                placeholder={hasProxySecret ? '••••••••' : 'sk-...'}
                autoComplete="new-password"
              />
              <p className="text-[10px] text-muted-foreground">Stored encrypted at rest. Never returned in API responses.</p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Response path (optional — dot notation, e.g. choices.0.message.content)</Label>
            <Input
              className="h-8 text-xs font-mono"
              value={value.proxyResponsePath}
              onChange={(e) => onPatch({ proxyResponsePath: e.target.value })}
              placeholder="auto-detect"
            />
            <p className="text-[10px] text-muted-foreground">Leave blank to auto-detect OpenAI / Anthropic / plain shapes.</p>
          </div>

          {onGroundProxyChange && (
            <div className="space-y-1 border-t border-border pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={!!groundProxy} onCheckedChange={onGroundProxyChange} />
                <span className="font-medium">Ground this proxy with attached knowledge</span>
              </label>
              <p className="text-[10px] text-muted-foreground ml-8 leading-relaxed">
                Before forwarding, retrieve from this agent's knowledge sources and enforce its answer mode.
                With <strong>Only my sources</strong>, an off-topic question is refused here and the external
                endpoint is never called; otherwise the retrieved context is prepended to the forwarded prompt.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
