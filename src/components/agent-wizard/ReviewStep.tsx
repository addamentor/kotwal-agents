/**
 * ReviewStep — a compact summary of the draft before it is created/activated.
 */
import { ChatModelOption } from '@/services/agentApi';
import { Badge } from '@/components/ui/badge';
import { ANSWER_MODES, DraftFields } from './types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-xs">{children}</div>
    </div>
  );
}

export default function ReviewStep({ fields, models }: {
  fields: DraftFields;
  models: ChatModelOption[];
}) {
  const mode = ANSWER_MODES.find((m) => m.value === fields.answerMode);
  const modelName = fields.modelId === 'auto'
    ? 'Let the user choose'
    : (models.find((m) => m.id === fields.modelId)?.name ?? fields.modelId);

  const caps = [
    fields.toolConfig.fileAccess?.enabled && 'File access',
    fields.toolConfig.screenCapture?.enabled && 'Screen capture',
    fields.toolConfig.shellExec?.enabled && 'Shell exec',
    fields.toolConfig.webSearch && 'Web search',
  ].filter(Boolean) as string[];

  const mcpCount = fields.toolConfig.mcpServerIds?.length ?? 0;

  return (
    <div className="divide-y divide-border">
      <Row label="Name"><span className="font-medium">{fields.name || '—'}</span></Row>
      {fields.description && <Row label="Description">{fields.description}</Row>}
      <Row label="Answers">
        <span className="font-medium">{mode?.label}</span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{mode?.hint}</p>
      </Row>
      <Row label="Model">{modelName}</Row>
      <Row label="Visibility">{fields.shared ? 'Shared with organization' : 'Private'}</Row>
      {fields.agentType === 'proxy' && (
        <Row label="Proxy">
          <span className="font-mono text-[11px] break-all">{fields.proxyUrl || '—'}</span>
          {fields.toolConfig.groundProxy && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Grounded with attached knowledge before forwarding.</p>
          )}
        </Row>
      )}
      {mcpCount > 0 && (
        <Row label="MCP servers">{mcpCount} selected</Row>
      )}
      {caps.length > 0 && (
        <Row label="Capabilities">
          <div className="flex flex-wrap gap-1">
            {caps.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
          </div>
        </Row>
      )}
    </div>
  );
}
