import { useEffect, useRef, useState } from 'react';
import type {
    KeyboardEvent,
    PointerEvent as ReactPointerEvent,
    RefObject,
} from 'react';
import { Button } from '../Button';
import type { RoiRect } from '../../types';
import {
    clampRect,
    clientToImagePoint,
    normalizeRect,
} from '../../utils/roiGeometry';

interface ImageCanvasProps {
    objectUrl: string;
    /** Provided by the workspace hook so stats read the decoded pixels. */
    imageRef: RefObject<HTMLImageElement | null>;
    naturalWidth: number;
    naturalHeight: number;
    roi: RoiRect | null;
    onRoiChange: (rect: RoiRect | null) => void;
    onClearRoi: () => void;
    onResetRoi: () => void;
}

/**
 * Responsive image preview with a pointer-driven ROI overlay.
 * All coordinates are kept in ORIGINAL image pixels; the preview scale is
 * measured continuously (ResizeObserver) so selections stay accurate when
 * the layout rescales.
 */
export function ImageCanvas({
    objectUrl,
    imageRef,
    naturalWidth,
    naturalHeight,
    roi,
    onRoiChange,
    onClearRoi,
    onResetRoi,
}: ImageCanvasProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const [draft, setDraft] = useState<RoiRect | null>(null);
    const [scale, setScale] = useState(1);

    // Track the on-screen preview scale.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || naturalWidth === 0) return;

        const update = () => {
            const rect = stage.getBoundingClientRect();
            setScale(rect.width > 0 ? rect.width / naturalWidth : 1);
        };
        update();

        const observer = new ResizeObserver(update);
        observer.observe(stage);
        return () => observer.disconnect();
    }, [naturalWidth, objectUrl]);

    /** Convert a viewport point to ORIGINAL image pixels (clamped). */
    const toImagePoint = (clientX: number, clientY: number) => {
        const stage = stageRef.current;
        if (!stage) return { x: 0, y: 0 };
        return clientToImagePoint(
            clientX,
            clientY,
            stage.getBoundingClientRect(),
            naturalWidth,
            naturalHeight,
        );
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = toImagePoint(event.clientX, event.clientY);
        dragStartRef.current = point;
        setDraft(
            clampRect(
                normalizeRect(point.x, point.y, point.x, point.y),
                naturalWidth,
                naturalHeight,
            ),
        );
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        if (!start) return;
        const point = toImagePoint(event.clientX, event.clientY);
        setDraft(
            clampRect(
                normalizeRect(start.x, start.y, point.x, point.y),
                naturalWidth,
                naturalHeight,
            ),
        );
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        if (!start) return;
        dragStartRef.current = null;
        setDraft(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        const point = toImagePoint(event.clientX, event.clientY);
        const rect = clampRect(
            normalizeRect(start.x, start.y, point.x, point.y),
            naturalWidth,
            naturalHeight,
        );
        // Ignore accidental clicks; only deliberate drags replace the ROI.
        if (rect.width >= 2 && rect.height >= 2) {
            onRoiChange(rect);
        }
    };

    /** Keyboard alternative: Enter creates a centred ROI, arrows nudge it. */
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!roi) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const width = Math.max(1, Math.round(naturalWidth * 0.25));
                const height = Math.max(1, Math.round(naturalHeight * 0.25));
                onRoiChange(
                    clampRect(
                        {
                            x: Math.round((naturalWidth - width) / 2),
                            y: Math.round((naturalHeight - height) / 2),
                            width,
                            height,
                        },
                        naturalWidth,
                        naturalHeight,
                    ),
                );
            }
            return;
        }

        const step = event.shiftKey ? 10 : 1;
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
        };
        const move = moves[event.key];
        if (move) {
            event.preventDefault();
            onRoiChange(
                clampRect(
                    { ...roi, x: roi.x + move[0] * step, y: roi.y + move[1] * step },
                    naturalWidth,
                    naturalHeight,
                ),
            );
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onClearRoi();
        }
    };

    const updateCoordinate = (field: keyof RoiRect, raw: string) => {
        if (!roi) return;
        const value = Number.parseInt(raw, 10);
        if (Number.isNaN(value)) return;
        onRoiChange(clampRect({ ...roi, [field]: value }, naturalWidth, naturalHeight));
    };

    const active = draft ?? roi;
    const displayWidth = naturalWidth * scale;
    const badgeRight = active
        ? (active.x + active.width) * scale > displayWidth - 170
        : false;

    return (
        <div className="flex flex-col gap-3">
            {/* Controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-[rgba(14,28,54,0.5)] px-4 py-3">
                <div className="flex flex-wrap gap-2.5">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                            onClearRoi();
                            overlayRef.current?.focus();
                        }}
                    >
                        Select region
                    </Button>
                    <Button variant="secondary" size="sm" onClick={onResetRoi}>
                        Full image
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onClearRoi}
                        disabled={!roi}
                    >
                        Clear
                    </Button>
                </div>
                <span className="mono text-[11.5px] text-txt-muted">
                    Preview {Math.round(scale * 100)}% · coordinates in original pixels
                </span>
            </div>

            {/* Image stage with ROI overlay */}
            <div className="flex justify-center">
                <div
                    ref={stageRef}
                    className="relative inline-block max-w-full overflow-hidden rounded-lg border border-line bg-[#02050b] shadow-[0_4px_25px_rgba(0,0,0,0.5)]"
                >
                    <img
                        ref={imageRef}
                        src={objectUrl}
                        alt="Uploaded image preview for region-of-interest selection"
                        draggable={false}
                        className="block max-h-[480px] max-w-full select-none"
                    />
                    <div
                        ref={overlayRef}
                        tabIndex={0}
                        role="group"
                        aria-label="Region of interest drawing area"
                        aria-describedby="roi-help"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={handleKeyDown}
                        className="absolute inset-0 cursor-crosshair touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan"
                    >
                        {active ? (
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute border-2 border-dashed border-cyan bg-[rgba(0,242,254,0.18)] shadow-[0_0_14px_rgba(0,242,254,0.35)]"
                                style={{
                                    left: active.x * scale,
                                    top: active.y * scale,
                                    width: active.width * scale,
                                    height: active.height * scale,
                                }}
                            >
                                <span
                                    className="mono absolute whitespace-nowrap rounded border border-cyan bg-[rgba(5,12,26,0.95)] px-2 py-0.5 text-[11px] font-bold text-cyan shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                                    style={{
                                        top: active.y * scale < 26 ? 4 : -26,
                                        ...(badgeRight ? { right: 0 } : { left: 0 }),
                                    }}
                                >
                                    {active.x},{active.y} · {active.width}×{active.height}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Exact coordinate entry (keyboard-accessible alternative) */}
            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
                {(['x', 'y', 'width', 'height'] as const).map((field) => (
                    <label key={field} className="flex flex-col gap-1.5">
                        <span className="mono text-[10.5px] uppercase tracking-[0.6px] text-txt-muted">
                            {field === 'width' || field === 'height' ? field : field.toUpperCase()}
                        </span>
                        <input
                            type="number"
                            className="field-input py-2 text-[13px]"
                            value={roi ? roi[field] : ''}
                            disabled={!roi}
                            min={0}
                            aria-label={`ROI ${field} in original image pixels`}
                            onChange={(event) => updateCoordinate(field, event.target.value)}
                        />
                    </label>
                ))}
            </div>

            <p id="roi-help" className="text-[12px] leading-relaxed text-txt-muted">
                Drag on the preview to draw a rectangle (coordinates and statistics always
                use original image pixels). With the preview focused:{' '}
                <span className="mono text-txt-2">Enter</span> creates a centred selection,{' '}
                <span className="mono text-txt-2">arrow keys</span> move it (
                <span className="mono text-txt-2">Shift</span> = 10 px steps),{' '}
                <span className="mono text-txt-2">Delete</span> clears it.
            </p>
        </div>
    );
}
