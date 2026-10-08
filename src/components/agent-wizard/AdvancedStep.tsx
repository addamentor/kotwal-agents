/**
 * AdvancedStep — optional power-user settings: local CLI capabilities, MCP server
 * selection, and 3rd-party proxy routing. Composed from focused editors so the
 * wizard carries the full capability of the original AgentForm (no regression).
 */
import { DraftFields } from './types';
import { Switch } from '@/components/ui/switch';
import LocalCapabilitiesEditor from './LocalCapabilitiesEditor';
import McpServerSelector from './McpServerSelector';
import ProxyConfigEditor, { ProxyFields } from './ProxyConfigEditor';

export default function AdvancedStep({ fields, setField, hasProxySecret }: {
  fields: DraftFields;
  setField: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
  hasProxySecret?: boolean;
}) {
  const proxyValue: ProxyFields = {
    agentType: fields.agentType,
    proxyUrl: fields.proxyUrl,
    proxyAuthType: fields.proxyAuthType,
    proxyAuthHeader: fields.proxyAuthHeader,
    proxyAuthSecret: fields.proxyAuthSecret,
    proxyResponsePath: fields.proxyResponsePath,
  };
  const patchProxy = (patch: Partial<ProxyFields>) => {
    (Object.entries(patch) as [keyof ProxyFields, ProxyFields[keyof ProxyFields]][])
      .forEach(([k, v]) => setField(k, v as DraftFields[typeof k]));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border px-3 py-3">
        <h3 className="text-xs font-semibold mb-2">Local capabilities</h3>
        <LocalCapabilitiesEditor value={fields.toolConfig} onChange={(tc) => setField('toolConfig', tc)} />
      </section>

      <section className="rounded-lg border border-border px-3 py-3">
        <h3 className="text-xs font-semibold mb-2">MCP servers</h3>
        <McpServerSelector
          selectedIds={fields.toolConfig.mcpServerIds ?? []}
          onChange={(ids) => setField('toolConfig', { ...fields.toolConfig, mcpServerIds: ids })}
        />
      </section>

      <section className="rounded-lg border border-border px-3 py-3">
        <h3 className="text-xs font-semibold mb-2">Knowledge access</h3>
        <label className="flex items-start gap-2 cursor-pointer">
          <Switch
            checked={!!fields.toolConfig.requireDriveAccess}
            onCheckedChange={(v) => setField('toolConfig', { ...fields.toolConfig, requireDriveAccess: v })}
          />
          <span className="text-xs">
            <span className="font-medium">Require per-user Drive access</span>
            <span className="block text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              For Google Drive / OneDrive knowledge sources, each user must have their own access to the
              underlying file. Users without a connection to that provider — or without access to the file —
              won't see those chunks. URL and uploaded-file sources are always shared.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-lg border border-border px-3 py-3">
        <h3 className="text-xs font-semibold mb-2">3rd-party agent (proxy)</h3>
        <ProxyConfigEditor
          value={proxyValue}
          hasProxySecret={hasProxySecret}
          groundProxy={fields.toolConfig.groundProxy}
          onGroundProxyChange={(v) => setField('toolConfig', { ...fields.toolConfig, groundProxy: v })}
          onPatch={patchProxy}
        />
      </section>
    </div>
  );
}
