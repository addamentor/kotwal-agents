/**
 * useAgentDraft — owns the wizard's draft lifecycle.
 *
 * The Knowledge step needs a real `agentId` to attach files/URLs against, so the
 * agent is persisted as an *inactive draft* the moment the user leaves Basics.
 * Review flips it active. Cancelling an unfinished, freshly-created draft can
 * delete it so abandoned drafts don't accumulate. Edit mode enters with an
 * existing agent id and never auto-creates or deletes.
 *
 * The hook holds field state + the persisted agent id; steps read `fields` and
 * mutate via `setField`. All API calls funnel through here so no component
 * re-implements create/update/finalize.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Agent, createAgent, updateAgent, deleteAgent } from '@/services/agentApi';
import { DraftFields, fieldsFromAgent, fieldsToInput, validateDraft } from './types';

export interface UseAgentDraft {
  fields: DraftFields;
  setField: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
  agentId: string | null;
  /** True while a create/update/finalize request is in flight. */
  saving: boolean;
  /** True when this session created an inactive draft that hasn't been finalized. */
  createdDraft: boolean;
  /** Ensure a persisted (inactive) draft exists; returns its id. Validates first. */
  ensureDraft: () => Promise<string>;
  /** Persist current field edits to the existing draft/agent (no status change). */
  persist: () => Promise<void>;
  /** Persist + activate; returns the saved agent. */
  finalize: () => Promise<Agent>;
  /** Delete the draft if it was created this session and never finalized. */
  discardIfUnfinished: () => Promise<void>;
}

export function useAgentDraft(agent: Agent | null, open: boolean): UseAgentDraft {
  const [fields, setFields] = useState<DraftFields>(() => fieldsFromAgent(agent));
  const [agentId, setAgentId] = useState<string | null>(agent?.id ?? null);
  const [saving, setSaving] = useState(false);
  // Reactive mirror of createdHere for rendering the cancel/discard affordance.
  const [createdDraft, setCreatedDraft] = useState(false);
  // True only for drafts this session created (create mode) and not yet finalized.
  const createdHere = useRef(false);
  const finalized = useRef(false);
  // Latest fields for async closures that must not capture a stale snapshot.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // Re-seed whenever the dialog (re)opens for a given agent.
  useEffect(() => {
    if (!open) return;
    setFields(fieldsFromAgent(agent));
    setAgentId(agent?.id ?? null);
    createdHere.current = false;
    finalized.current = false;
    setCreatedDraft(false);
  }, [open, agent]);

  const setField = useCallback(<K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const ensureDraft = useCallback(async (): Promise<string> => {
    if (agentId) return agentId;
    const err = validateDraft(fieldsRef.current);
    if (err) throw new Error(err);
    setSaving(true);
    try {
      const created = await createAgent(fieldsToInput(fieldsRef.current, { status: 'inactive' }));
      createdHere.current = true;
      setCreatedDraft(true);
      setAgentId(created.id);
      return created.id;
    } finally { setSaving(false); }
  }, [agentId]);

  const persist = useCallback(async (): Promise<void> => {
    if (!agentId) return;
    const err = validateDraft(fieldsRef.current);
    if (err) throw new Error(err);
    setSaving(true);
    try { await updateAgent(agentId, fieldsToInput(fieldsRef.current)); }
    finally { setSaving(false); }
  }, [agentId]);

  const finalize = useCallback(async (): Promise<Agent> => {
    const err = validateDraft(fieldsRef.current);
    if (err) throw new Error(err);
    setSaving(true);
    try {
      // A new draft flips inactive → active; an edited agent keeps its status.
      const activate = createdHere.current ? { status: 'active' as const } : {};
      const input = fieldsToInput(fieldsRef.current, activate);
      const saved = agentId ? await updateAgent(agentId, input) : await createAgent({ ...input, status: 'active' });
      finalized.current = true;
      setAgentId(saved.id);
      return saved;
    } finally { setSaving(false); }
  }, [agentId]);

  const discardIfUnfinished = useCallback(async (): Promise<void> => {
    if (!agentId || !createdHere.current || finalized.current) return;
    await deleteAgent(agentId);
    createdHere.current = false;
    setCreatedDraft(false);
    setAgentId(null);
  }, [agentId]);

  return { fields, setField, agentId, saving, createdDraft, ensureDraft, persist, finalize, discardIfUnfinished };
}
