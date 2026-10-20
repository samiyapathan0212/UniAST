/**
 * Image-sequence input (path A): multi-file dropzone + per-frame list.
 * Times are validated by the parent before processing; duplicates warn.
 */
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button } from '../Button';
import { ACCEPTED_IMAGE_LABEL, ACCEPTED_IMAGE_TYPES } from '../../hooks/useImageWorkspace';
import type { SequenceFrame } from '../../hooks/useKineticSequence';

interface SequenceManagerProps {
    frames: SequenceFrame[];
    sequenceError: string | null;
    busy: boolean;
    onAddFiles: (files: FileList | File[]) => void;
    onSetTime: (id: string, timeMin: number) => void;
    onRemove: (id: string) => void;
    onClear: () => void;
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

function statusBadge(status: SequenceFrame['status']): string {
    switch (status) {
        case 'ready':
            return 'badge-pass';
        case 'error':
            return 'badge-alert';
        default:
            return 'badge-pending';
    }
}

export function SequenceManager({
    frames,
    sequenceError,
    busy,
    onAddFiles,
    onSetTime,
    onRemove,
    onClear,
}: SequenceManagerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files?.length) onAddFiles(event.dataTransfer.files);
    };

    return (
        <div className="flex flex-col gap-4">
            <div
                role="button"
                tabIndex={0}
                aria-label="Add sequence images: drop files here or press Enter to browse"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={[
                    'cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                    dragOver
                        ? 'border-cyan bg-[rgba(0,242,254,0.08)]'
                        : 'border-[rgba(0,242,254,0.35)] bg-[rgba(10,20,42,0.45)] hover:border-cyan',
                ].join(' ')}
            >
                <p className="text-[15px] font-semibold text-white">
                    Drop sequence images here, or{' '}
                    <span className="text-cyan underline underline-offset-4">browse</span>
                </p>
                <p className="mono mt-1.5 text-[11.5px] text-txt-muted">
                    {ACCEPTED_IMAGE_LABEL} · multiple accepted · never uploaded
                </p>
            </div>

            <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                aria-label={`Choose sequence image files (${ACCEPTED_IMAGE_LABEL})`}
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={(event) => {
                    if (event.target.files?.length) onAddFiles(event.target.files);
                    event.target.value = '';
                }}
            />

            {sequenceError ? (
                <p
                    role="alert"
                    className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-3 text-[13px] text-[#fecaca]"
                >
                    {sequenceError}
                </p>
            ) : null}
            {frames.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="mono text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                            {frames.length} frame{frames.length === 1 ? '' : 's'}
                        </span>
                        <Button variant="danger" size="sm" onClick={onClear} disabled={busy}>
                            Clear sequence
                        </Button>
                    </div>
                    <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
                        {frames.map((frame) => (
                            <li
                                key={frame.id}
                                className="flex items-center gap-3 rounded-lg border border-line bg-[rgba(255,255,255,0.03)] px-3 py-2"
                            >
                                <img
                                    src={frame.objectUrl}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-10 w-10 shrink-0 rounded border border-line object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium text-txt">
                                        {frame.fileName}
                                    </p>
                                    <p className="mono text-[11px] text-txt-muted">
                                        {formatBytes(frame.fileSize)}
                                        {frame.status === 'ready'
                                            ? ` · ${frame.width}x${frame.height}px`
                                            : ` · ${frame.status.toUpperCase()}`}
                                        {frame.status === 'error' && frame.error ? ` · ${frame.error}` : ''}
                                    </p>
                                </div>
                                <span className={`badge ${statusBadge(frame.status)} shrink-0`}>
                                    {frame.status.toUpperCase()}
                                </span>
                                <label className="flex shrink-0 items-center gap-1.5">
                                    <span className="mono text-[10.5px] uppercase text-txt-muted">
                                        t&nbsp;(min)
                                    </span>
                                    <input
                                        type="number"
                                        className="field-input w-20 py-1.5 text-[13px]"
                                        value={Number.isFinite(frame.timeMin) ? frame.timeMin : 0}
                                        min={0}
                                        step="any"
                                        disabled={busy}
                                        aria-label={`Elapsed time in minutes for ${frame.fileName}`}
                                        onChange={(event) => {
                                            const value = Number(event.target.value);
                                            if (Number.isFinite(value) && value >= 0) {
                                                onSetTime(frame.id, value);
                                            }
                                        }}
                                    />
                                </label>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onRemove(frame.id)}
                                    disabled={busy}
                                    aria-label={`Remove ${frame.fileName}`}
                                >
                                    ✕
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
