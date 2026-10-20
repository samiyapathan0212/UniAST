import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button } from '../Button';
import {
    ACCEPTED_IMAGE_LABEL,
    ACCEPTED_IMAGE_TYPES,
} from '../../hooks/useImageWorkspace';

interface ImageUploaderProps {
    onFileSelected: (file: File) => void;
    /** Validation / decode error surfaced by the workspace hook. */
    error: string | null;
    busy?: boolean;
}

/**
 * Drag-and-drop zone plus a file-picker button.
 * Accepts PNG / JPEG / WebP only; anything else is reported by the parent.
 */
export function ImageUploader({ onFileSelected, error, busy = false }: ImageUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFileSelected(file);
    };

    return (
        <div className="flex flex-col gap-3">
            <div
                role="button"
                tabIndex={0}
                aria-label="Upload an image: drop a file here or press Enter to browse"
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
                onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={[
                    'cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                    dragOver
                        ? 'border-cyan bg-[rgba(0,242,254,0.08)] shadow-[0_0_30px_rgba(0,242,254,0.2)]'
                        : 'border-[rgba(0,242,254,0.35)] bg-[rgba(10,20,42,0.45)] hover:border-cyan hover:bg-[rgba(0,242,254,0.06)]',
                ].join(' ')}
            >
                <svg
                    className="mx-auto mb-3.5 h-12 w-12 text-cyan"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="M17 8l-5-5-5 5" />
                    <path d="M12 3v13" />
                </svg>
                <p className="text-[15px] font-semibold text-white">
                    Drop an image here, or{' '}
                    <span className="text-cyan underline underline-offset-4">browse</span>
                </p>
                <p className="mono mt-1.5 text-[11.5px] text-txt-muted">
                    {ACCEPTED_IMAGE_LABEL} · processed entirely in your browser · never
                    uploaded
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                >
                    Choose file
                </Button>
                <span className="mono text-[11px] text-txt-muted">
                    Replacing the current image releases its previous object URL.
                </span>
            </div>

            <input
                ref={inputRef}
                type="file"
                className="sr-only"
                aria-label={`Choose an image file (${ACCEPTED_IMAGE_LABEL})`}
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFileSelected(file);
                    event.target.value = ''; // allow re-selecting the same file
                }}
            />

            {error ? (
                <p
                    role="alert"
                    className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-3 text-[13px] leading-relaxed text-[#fecaca]"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
