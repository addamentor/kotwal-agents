/**
 * LocalCapabilitiesEditor — local tool permissions used by the kotwal-agent CLI
 * when an agent runs on a user's machine (file access, screen capture, shell,
 * web search). Extracted from the original AgentForm so the wizard's Advanced
 * step and any future surface share one implementation.
 */
import { FolderOpen, Monitor, Terminal, Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToolConfig } from '@/services/agentApi';
import { cn } from '@/lib/utils';

export default function LocalCapabilitiesEditor({ value, onChange }: {
  value: ToolConfig;
  onChange: (next: ToolConfig) => void;
}) {
  const patch = (p: Partial<ToolConfig>) => onChange({ ...value, ...p });

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground leading-relaxed">
        These capabilities are used by the <strong>kotwal-agent CLI</strong> when a user
        runs this agent locally. They let the agent read files, capture the screen, or
        run shell commands on the user's machine. All output still passes through
        Kotwal's detection engine before reaching the model.
      </p>

      {/* File access */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch
            checked={value.fileAccess?.enabled ?? false}
            onCheckedChange={(v) => patch({ fileAccess: { ...value.fileAccess, enabled: v } })}
          />
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">File access</span>
        </label>
        {value.fileAccess?.enabled && (
          <div className="ml-8 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Allowed paths (one per line)</Label>
            <Textarea
              className="text-xs min-h-[60px] font-mono"
              value={(value.fileAccess.allowedPaths ?? []).join('\n')}
              onChange={(e) => patch({
                fileAccess: {
                  ...value.fileAccess,
                  allowedPaths: e.target.value.split('\n').map((p) => p.trim()).filter(Boolean),
                },
              })}
              placeholder="~/Documents&#10;./data"
            />
            <p className="text-[10px] text-muted-foreground">The agent can only read/write within these directories.</p>
          </div>
        )}
      </div>

      {/* Screen capture */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch
          checked={value.screenCapture?.enabled ?? false}
          onCheckedChange={(v) => patch({ screenCapture: { enabled: v } })}
        />
        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">Screen capture</span>
        <span className="text-muted-foreground ml-1">— agent can take a screenshot of the user's primary display</span>
      </label>

      {/* Shell exec */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch
            checked={value.shellExec?.enabled ?? false}
            onCheckedChange={(v) => patch({ shellExec: { ...value.shellExec, enabled: v } })}
          />
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Shell execution</span>
          <span className={cn('ml-1 font-semibold', value.shellExec?.enabled ? 'text-amber-500' : 'text-muted-foreground')}>
            {value.shellExec?.enabled ? '⚠ Advanced' : '— advanced, off by default'}
          </span>
        </label>
        {value.shellExec?.enabled && (
          <div className="ml-8 space-y-1">
            <Label className="text-[10px] text-muted-foreground">Allowed commands (one per line, plain names only — no paths)</Label>
            <Textarea
              className="text-xs min-h-[60px] font-mono"
              value={(value.shellExec.allowedCommands ?? []).join('\n')}
              onChange={(e) => patch({
                shellExec: {
                  ...value.shellExec,
                  allowedCommands: e.target.value.split('\n').map((c) => c.trim()).filter(Boolean),
                },
              })}
              placeholder="git&#10;npm&#10;python3"
            />
            <p className="text-[10px] text-amber-500">Only these exact command names can be run. Arguments are passed safely without shell interpolation.</p>
          </div>
        )}
      </div>

      {/* Web search */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch
          checked={value.webSearch ?? false}
          onCheckedChange={(v) => patch({ webSearch: v })}
        />
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">Web search</span>
        <span className="text-muted-foreground ml-1">— agent may search the internet (requires web search to be enabled for your tenant)</span>
      </label>
    </div>
  );
}
