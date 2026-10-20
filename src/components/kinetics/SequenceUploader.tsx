import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button } from '../Button';
import {
    ACCEPTED_IMAGE_LABEL,
    ACCEPTED_IMAGE_TYPES,
} from '../../hooks/useImageWorkspace';

interface SequenceUploaderProps {
    onFilesSelected: (files: FileList | File[]) => void;
    busy: boolean;
    error: string | null;
}

/** Multi-image dropzone + picker for the kinetic sequence (PNG/JPEG/WebP). */
export function SequenceUploader({ onFilesSelected, busy, error }: SequenceUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            onFilesSelected(event.dataTransfer.files);
        }
    };

    return (
        <div className="flex flex-col gap-3">
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
                onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={[
                    'cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                    dragOver
                        ? 'border-cyan bg-[rgba(0,242,254,0.08)] shadow-[0_0_30px_rgba(0,242,254,0.2)]'
                        : 'border-[rgba(0,242,254,0.35)] bg-[rgba(10,20,42,0.45)] hover:border-cyan hover:bg-[rgba(0,242,254,0.06)]',
                ].join(' ')}
            >
                <p className="text-[15px] font-semibold text-white">
                    Drop sequence images here, or{' '}
                    <span className="text-cyan underline underline-offset-4">browse</span>
                </p>
                <p className="mono mt-1.5 text-[11.5px] text-txt-muted">
                    {ACCEPTED_IMAGE_LABEL} · multiple files accepted · processed in your
                    browser · never uploaded
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                >
                    Add images
                </Button>
            </div>

            <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                aria-label={`Choose sequence image files (${ACCEPTED_IMAGE_LABEL})`}
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={(event) => {
                    if (event.target.files && event.target.files.length > 0) {
                        onFilesSelected(event.target.files);
                    }
                    event.target.value = '';
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
