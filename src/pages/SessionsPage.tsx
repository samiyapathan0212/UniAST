import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { TextAreaField, TextField } from '../components/FormControls';
import {
    createResearchSession,
    deleteResearchSession,
    getResearchSession,
    listResearchSessions,
    updateResearchSession,
    type ResearchSession,
} from '../services/sessions';

function formatTimestamp(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SessionsPage() {
    const [sessions, setSessions] = useState<ResearchSession[]>([]);
    const [total, setTotal] = useState(0);
    const [name, setName] = useState('');
    const [device, setDevice] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selected, setSelected] = useState<ResearchSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const refreshSessions = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await listResearchSessions();
            setSessions(result.items);
            setTotal(result.total);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not load saved sessions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refreshSessions();
    }, []);

    const clearForm = () => {
        setName('');
        setDevice('');
        setNotes('');
        setEditingId(null);
    };

    const handleEdit = (record: ResearchSession) => {
        setEditingId(record.id);
        setName(record.name);
        setDevice(record.device ?? '');
        setNotes(record.notes ?? '');
        setError(null);
        setSuccess(null);
    };

    const handleSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim()) {
            setError('Enter a session name before saving.');
            return;
        }
        if (saving || deletingId !== null) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const payload = {
                name: name.trim(),
                device: device.trim() || null,
                notes: notes.trim() || null,
            };
            if (editingId) {
                const record = await updateResearchSession(editingId, payload);
                setSessions((current) => current.map((item) => item.id === record.id ? record : item));
                setSelected((current) => current?.id === record.id ? record : current);
                clearForm();
                setSuccess(`Updated “${record.name}”.`);
            } else {
                const record = await createResearchSession(payload);
                setSessions((current) => [record, ...current].slice(0, 50));
                setTotal((current) => current + 1);
                clearForm();
                setSelected(record);
                setSuccess(`Saved “${record.name}”.`);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save the session.');
        } finally {
            setSaving(false);
        }
    };

    const handleLoad = async (id: string) => {
        if (saving || deletingId !== null || loadingId !== null) return;
        setLoadingId(id);
        setError(null);
        setSuccess(null);
        try {
            const record = await getResearchSession(id);
            setSelected(record);
            setSuccess(`Loaded “${record.name}”.`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not load the session.');
        } finally {
            setLoadingId(null);
        }
    };

    const handleDelete = async (record: ResearchSession) => {
        if (saving || deletingId !== null || loadingId !== null) return;
        const confirmed = window.confirm(
            `Delete “${record.name}” and all of its saved analysis records? This cannot be undone. Original images and CSV files are not stored by the service.`,
        );
        if (!confirmed) return;

        setDeletingId(record.id);
        setError(null);
        setSuccess(null);
        try {
            await deleteResearchSession(record.id);
            setSessions((current) => current.filter((item) => item.id !== record.id));
            setTotal((current) => Math.max(0, current - 1));
            setSelected((current) => current?.id === record.id ? null : current);
            if (editingId === record.id) clearForm();
            setSuccess(`Deleted “${record.name}” and its saved analysis records.`);
            await refreshSessions();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete the session.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <PageHeader
                title="Saved Sessions"
                subtitle="Save and retrieve research-session notes locally. Analysis pages can separately save derived results; source image and CSV files stay in this browser."
            />

            {error ? (
                <p role="alert" className="mb-5 rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-3 text-[13px] leading-relaxed text-[#fecaca]">
                    {error}
                </p>
            ) : null}
            {success ? (
                <p role="status" className="mb-5 rounded-lg border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] px-4 py-3 text-[13px] text-[#a7f3d0]">
                    {success}
                </p>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <GlassCard glow title={editingId ? 'Edit research session' : 'Save a research session'}>
                    <p className="mb-4 text-[13px] leading-relaxed text-txt-muted">
                        Saving is explicit. Only the name, optional device description and notes are sent to the local backend; no images, ROI measurements, calibration values or kinetic results are uploaded.
                    </p>
                    <form className="flex flex-col gap-4" onSubmit={handleSave}>
                        <TextField
                            label="Session name"
                            placeholder="e.g. Panel run — October 20"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={120}
                            required
                        />
                        <TextField
                            label="Device description"
                            hint="optional"
                            placeholder="e.g. Pixel 8"
                            value={device}
                            onChange={(event) => setDevice(event.target.value)}
                            maxLength={120}
                        />
                        <TextAreaField
                            label="Research notes"
                            hint="optional"
                            rows={4}
                            placeholder="Non-identifying setup notes"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            maxLength={2000}
                        />
                        <div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" variant="primary" disabled={saving || deletingId !== null}>
                                    {saving ? (editingId ? 'Updating…' : 'Saving…') : (editingId ? 'Save changes' : 'Save session')}
                                </Button>
                                {editingId ? (
                                    <Button onClick={clearForm} disabled={saving || deletingId !== null}>
                                        Cancel edit
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </form>
                </GlassCard>

                <GlassCard
                    glow
                    title="Saved sessions"
                    action={
                        <Button size="sm" onClick={() => void refreshSessions()} disabled={loading}>
                            {loading ? 'Loading…' : 'Refresh'}
                        </Button>
                    }
                >
                    <p className="mono mb-3 text-[11.5px] text-txt-muted" aria-live="polite">
                        {loading ? 'Loading sessions…' : `${total} saved session${total === 1 ? '' : 's'}`}
                    </p>
                    {loading ? (
                        <div role="status" className="rounded-lg border border-line px-4 py-8 text-center text-[13px] text-txt-muted">
                            Connecting to the local session service…
                        </div>
                    ) : sessions.length === 0 ? (
                        <EmptyState
                            title={error ? 'Session service unavailable' : 'No saved sessions yet'}
                            description={error ? 'Start the local backend, then refresh. Image analysis and CSV export continue to work without it.' : 'Create a session with the form to save its name, device description and research notes.'}
                        />
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {sessions.map((record) => (
                                <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-[rgba(14,28,54,0.45)] px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-[14px] font-semibold text-white">{record.name}</p>
                                        <p className="mono mt-1 text-[11px] text-txt-muted">
                                            {record.device || 'No device specified'} · {formatTimestamp(record.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" onClick={() => void handleLoad(record.id)} disabled={loadingId !== null || saving || deletingId !== null}>
                                            {loadingId === record.id ? 'Loading…' : 'Load'}
                                        </Button>
                                        <Button size="sm" onClick={() => handleEdit(record)} disabled={loadingId !== null || saving || deletingId !== null}>
                                            Edit
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => void handleDelete(record)} disabled={loadingId !== null || saving || deletingId !== null}>
                                            {deletingId === record.id ? 'Deleting…' : 'Delete'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selected ? (
                        <div className="mt-5 rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.04)] p-4" aria-label="Loaded session details">
                            <h3 className="text-[14px] font-semibold text-cyan">{selected.name}</h3>
                            <p className="mono mt-2 text-[11.5px] text-txt-muted">ID {selected.id}</p>
                            <p className="mt-2 text-[13px] text-txt-2">Device: {selected.device || 'Not specified'}</p>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] text-txt-2">Notes: {selected.notes || 'None'}</p>
                            <p className="mono mt-3 text-[11px] text-txt-muted">Created {formatTimestamp(selected.createdAt)}</p>
                        </div>
                    ) : null}
                </GlassCard>
            </div>
        </div>
    );
}
