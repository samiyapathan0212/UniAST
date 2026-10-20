/**
 * Image-sequence input: multi-file picker, per-frame elapsed-time editing,
 * decode status, remove/clear. Pixels never leave the browser.
 */
import { useRef } from 'react';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { ACCEPTED_IMAGE_LABEL } from '../../hooks/useImageWorkspace';
import type { SequenceFrame } from '../../hooks/useKineticSequence';

interface SequenceInputProps {
    frames: SequenceFrame[];
    sequenceError: string | null;
    onAddFiles: (files: FileList | File[]) => void;
    onSetTime: (id: string, timeMin: number) => void;
    onRemove: (id: string) => void;
    onClear: () => void;
    busy: boolean;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const STATUS_TONE = { pending: 'pending', loading: 'pending', ready: 'pass', error: 'alert' } as const;

export function SequenceInput({
    frames,
    sequenceError,
    onAddFiles,
    onSetTime,
    onRemove,
    onClear,
    busy,
}: SequenceInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                >
                    Add images
                </Button>
                {frames.length > 0 ? (
                    <Button variant="danger" size="sm" disabled={busy} onClick={onClear}>
                        Clear sequence
                    </Button>
                ) : null}
                <span className="mono text-[11px] text-txt-muted">
                    {ACCEPTED_IMAGE_LABEL} · {frames.length} frame(s) · in-browser only
                </span>
            </div>

            <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                aria-label={`Add image frames (${ACCEPTED_IMAGE_LABEL})`}
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                    if (event.target.files && event.target.files.length > 0) {
                        onAddFiles(event.target.files);
                    }
                    event.target.value = '';
                }}
            />

            {sequenceError ? (
                <p
                    role="alert"
                    className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-3 text-[13px] leading-relaxed text-[#fecaca]"
                >
                    {sequenceError}
                </p>
            ) : null}

            {frames.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-txt-muted">
                    No frames yet. Add two or more images captured at known elapsed times.
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {frames.map((frame) => (
                        <li
                            key={frame.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-[rgba(14,28,54,0.5)] px-4 py-3"
                        >
                            <img
                                src={frame.objectUrl}
                                alt=""
                                aria-hidden="true"
                                className="h-12 w-12 shrink-0 rounded border border-line object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="mono truncate text-[12.5px] text-white">{frame.fileName}</p>
                                <p className="mono text-[11px] text-txt-muted">
                                    {formatBytes(frame.fileSize)}
                                    {frame.status === 'ready'
                                        ? ` · ${frame.width}×${frame.height}px`
                                        : frame.status === 'loading'
                                          ? ' · decoding…'
                                          : ''}
                                </p>
                                {frame.error ? (
                                    <p role="alert" className="mt-1 text-[12px] text-alert">
                                        {frame.error}
                                    </p>
                                ) : null}
                            </div>
                            <label className="mono flex items-center gap-2 text-[11.5px] text-txt-2">
                                t =
                                <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    className="field-input w-24 py-1.5 text-[12.5px]"
                                    value={frame.timeMin}
                                    disabled={busy}
                                    aria-label={`Elapsed time in minutes for ${frame.fileName}`}
                                    onChange={(event) => {
                                        const value = Number(event.target.value);
                                        if (Number.isFinite(value) && value >= 0) {
                                            onSetTime(frame.id, value);
                                        }
                                    }}
                                />
                                min
                            </label>
                            <Badge tone={STATUS_TONE[frame.status]}>{frame.status}</Badge>
                            <Button
                                variant="danger"
                                size="sm"
                                disabled={busy}
                                onClick={() => onRemove(frame.id)}
                                aria-label={`Remove ${frame.fileName}`}
                            >
                                Remove
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
