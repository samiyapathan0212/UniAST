import { useCallback, useEffect, useState } from 'react';
import { Button } from './Button';
import { GlassCard } from './GlassCard';
import {
    deleteAnalysisRecord,
    getResearchSession,
    listAnalysisRecords,
    listResearchSessions,
    type AnalysisKind,
    type AnalysisRecordSummary,
    type ResearchSession,
} from '../services/sessions';

interface AnalysisPersistencePanelProps {
    kind: AnalysisKind;
    title: string;
    canSave: boolean;
    disabledReason: string;
    onSave: (sessionId: string) => Promise<void>;
    onLoad: (sessionId: string, recordId: string) => Promise<void>;
}

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Session-scoped explicit save/load controls shared by the three workspaces. */
export function AnalysisPersistencePanel({
    kind,
    title,
    canSave,
    disabledReason,
    onSave,
    onLoad,
}: AnalysisPersistencePanelProps) {
    const [sessions, setSessions] = useState<ResearchSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [records, setRecords] = useState<AnalysisRecordSummary[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null);
    const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const refreshRecords = useCallback(async (sessionId: string) => {
        setLoadingRecords(true);
        try {
            const result = await listAnalysisRecords(sessionId, kind);
            setRecords(result.items);
            setError(null);
            return true;
        } catch (cause) {
            setRecords([]);
            setError(cause instanceof Error ? cause.message : 'Could not load saved analyses.');
            return false;
        } finally {
            setLoadingRecords(false);
        }
    }, [kind]);

    useEffect(() => {
        let active = true;
        void listResearchSessions()
            .then((result) => {
                if (!active) return;
                setSessions(result.items);
                setSelectedSessionId((current) => current || result.items[0]?.id || '');
                setError(null);
            })
            .catch((cause: unknown) => {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : 'Could not load research sessions.');
            })
            .finally(() => {
                if (active) setLoadingSessions(false);
            });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!selectedSessionId) {
            setRecords([]);
            return;
        }
        void refreshRecords(selectedSessionId);
    }, [refreshRecords, selectedSessionId]);

    const handleSave = async () => {
        if (!selectedSessionId || !canSave || saving || deletingRecordId !== null) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const session = await getResearchSession(selectedSessionId);
            await onSave(selectedSessionId);
            setSuccess(`Saved to “${session.name}”.`);
            await refreshRecords(selectedSessionId);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this analysis.');
        } finally {
            setSaving(false);
        }
    };

    const handleLoad = async (recordId: string) => {
        if (!selectedSessionId || saving || deletingRecordId !== null || loadingRecordId !== null) return;
        setLoadingRecordId(recordId);
        setError(null);
        setSuccess(null);
        try {
            await onLoad(selectedSessionId, recordId);
            setSuccess('Saved analysis loaded. Original files remain on this device and were not restored.');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not retrieve this analysis.');
        } finally {
            setLoadingRecordId(null);
        }
    };

    const handleDelete = async (record: AnalysisRecordSummary) => {
        if (!selectedSessionId || saving || deletingRecordId !== null || loadingRecordId !== null) return;
        const confirmed = window.confirm(
            `Delete this saved ${title.toLowerCase()} record? This cannot be undone. The original image or CSV, if any, remains local and is not stored in the record.`,
        );
        if (!confirmed) return;

        setDeletingRecordId(record.id);
        setError(null);
        setSuccess(null);
        try {
            await deleteAnalysisRecord(selectedSessionId, kind, record.id);
            const refreshed = await refreshRecords(selectedSessionId);
            if (refreshed) setSuccess(`Deleted saved ${title.toLowerCase()} record.`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete this analysis record.');
        } finally {
            setDeletingRecordId(null);
        }
    };

    return (
        <GlassCard glow title={title}>
            <p className="mb-4 text-[13px] leading-relaxed text-txt-muted">
                Save derived metadata and results to a research session. Original images and CSV files stay in this browser and are never uploaded.
            </p>
            {error ? <p role="alert" className="mb-3 rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-3 py-2.5 text-[12.5px] text-[#fecaca]">{error}</p> : null}
            {success ? <p role="status" className="mb-3 rounded-lg border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-3 py-2.5 text-[12.5px] text-[#a7f3d0]">{success}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex min-w-0 flex-1 flex-col gap-2 text-[13px] font-semibold text-txt-2">
                    Research session
                    <select
                        className="field-input"
                        value={selectedSessionId}
                        disabled={loadingSessions || sessions.length === 0 || saving || deletingRecordId !== null}
                        onChange={(event) => { setSelectedSessionId(event.target.value); setSuccess(null); }}
                    >
                        <option value="">{loadingSessions ? 'Loading sessions…' : sessions.length ? 'Choose a session' : 'No saved sessions'}</option>
                        {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                    </select>
                </label>
                <Button variant="primary" onClick={() => void handleSave()} disabled={!selectedSessionId || !canSave || saving || deletingRecordId !== null}>
                    {saving ? 'Saving…' : 'Save analysis'}
                </Button>
            </div>
            {!canSave ? <p className="mt-2 text-[12px] text-txt-muted">{disabledReason}</p> : null}

            <div className="mt-4 border-t border-line pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="mono text-[11px] text-txt-muted" aria-live="polite">
                        {loadingRecords ? 'Loading saved analyses…' : `${records.length} saved ${records.length === 1 ? 'record' : 'records'}`}
                    </p>
                    <Button size="sm" onClick={() => selectedSessionId && void refreshRecords(selectedSessionId)} disabled={!selectedSessionId || loadingRecords}>
                        Refresh
                    </Button>
                </div>
                {records.length === 0 && !loadingRecords ? (
                    <p className="rounded-lg border border-line px-3 py-4 text-center text-[12.5px] text-txt-muted">
                        {selectedSessionId ? 'No saved analysis records for this session yet.' : 'Create a research session on the Saved Sessions page first.'}
                    </p>
                ) : (
                    <ul className="flex max-h-52 flex-col gap-2 overflow-y-auto">
                        {records.map((record) => (
                            <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-[rgba(14,28,54,0.45)] px-3 py-2.5">
                                <span className="min-w-0">
                                    <span className="block truncate text-[12.5px] text-white">{formatDate(record.createdAt)}</span>
                                    <span className="mono text-[10.5px] text-txt-muted">Method {record.methodVersion}</span>
                                </span>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" onClick={() => void handleLoad(record.id)} disabled={loadingRecordId !== null || deletingRecordId !== null || saving}>
                                            {loadingRecordId === record.id ? 'Loading…' : 'Load'}
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => void handleDelete(record)} disabled={loadingRecordId !== null || deletingRecordId !== null || saving}>
                                            {deletingRecordId === record.id ? 'Deleting…' : 'Delete'}
                                        </Button>
                                    </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </GlassCard>
    );
}
