import { useEffect, useRef, useState } from 'react';
import type {
    KeyboardEvent,
    PointerEvent as ReactPointerEvent,
    RefObject,
} from 'react';
import { Button } from '../Button';
import type { CalibrationPatch, RoiRect } from '../../types';
import {
    clampRect,
    clientToImagePoint,
    normalizeRect,
} from '../../utils/roiGeometry';

interface CalibrationCanvasProps {
    objectUrl: string;
    imageRef: RefObject<HTMLImageElement | null>;
    naturalWidth: number;
    naturalHeight: number;
    patches: CalibrationPatch[];
    onCreatePatch: (rect: RoiRect) => void;
    onRemoveLastPatch: () => void;
    onClearPatches: () => void;
}

/**
 * Multi-patch drawing surface for the calibration page. Reuses the Image
 * Workspace coordinate approach: drags are converted to ORIGINAL image
 * pixels, so every patch rect is resolution-independent.
 */
export function CalibrationCanvas({
    objectUrl,
    imageRef,
    naturalWidth,
    naturalHeight,
    patches,
    onCreatePatch,
    onRemoveLastPatch,
    onClearPatches,
}: CalibrationCanvasProps) {
    const stageRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const [draft, setDraft] = useState<RoiRect | null>(null);
    const [scale, setScale] = useState(1);

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
        if (rect.width >= 2 && rect.height >= 2) {
            onCreatePatch(rect);
        }
    };

    /** Keyboard: Enter adds a small centred patch; Delete removes the last. */
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const width = Math.max(4, Math.round(naturalWidth * 0.08));
            const height = Math.max(4, Math.round(naturalHeight * 0.08));
            onCreatePatch(
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
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onRemoveLastPatch();
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-[rgba(14,28,54,0.5)] px-4 py-3">
                <span className="mono text-[11.5px] text-txt-muted">
                    {patches.length} patch{patches.length === 1 ? '' : 'es'} · drag on the
                    image to add a reference patch
                </span>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onClearPatches}
                    disabled={patches.length === 0}
                >
                    Clear all patches
                </Button>
            </div>

            <div className="flex justify-center">
                <div
                    ref={stageRef}
                    className="relative inline-block max-w-full overflow-hidden rounded-lg border border-line bg-[#02050b] shadow-[0_4px_25px_rgba(0,0,0,0.5)]"
                >
                    <img
                        ref={imageRef}
                        src={objectUrl}
                        alt="Uploaded image preview for selecting calibration reference patches"
                        draggable={false}
                        className="block max-h-[480px] max-w-full select-none"
                    />
                    <div
                        ref={overlayRef}
                        tabIndex={0}
                        role="group"
                        aria-label="Calibration patch drawing area"
                        aria-describedby="patch-help"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={handleKeyDown}
                        className="absolute inset-0 cursor-crosshair touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan"
                    >
                        {patches.map((patch, index) => {
                            const isValidation = patch.role === 'validation';
                            return (
                                <div
                                    key={patch.id}
                                    aria-hidden="true"
                                    className={`pointer-events-none absolute border-2 border-dashed ${
                                        isValidation
                                            ? 'border-violet bg-[rgba(168,85,247,0.16)] shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                                            : 'border-cyan bg-[rgba(0,242,254,0.16)] shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                                    }`}
                                    style={{
                                        left: patch.rect.x * scale,
                                        top: patch.rect.y * scale,
                                        width: patch.rect.width * scale,
                                        height: patch.rect.height * scale,
                                    }}
                                >
                                    <span
                                        className={`mono absolute whitespace-nowrap rounded border bg-[rgba(5,12,26,0.95)] px-1.5 py-0.5 text-[10px] font-bold ${
                                            isValidation
                                                ? 'border-violet text-violet'
                                                : 'border-cyan text-cyan'
                                        }`}
                                        style={{
                                            top: patch.rect.y * scale < 22 ? 2 : -20,
                                            left: 0,
                                        }}
                                    >
                                        P{index + 1}
                                        {isValidation ? ' · V' : ''}
                                    </span>
                                </div>
                            );
                        })}

                        {draft ? (
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute border-2 border-dashed border-pending bg-[rgba(245,158,11,0.14)]"
                                style={{
                                    left: draft.x * scale,
                                    top: draft.y * scale,
                                    width: draft.width * scale,
                                    height: draft.height * scale,
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            <p id="patch-help" className="text-[12px] leading-relaxed text-txt-muted">
                Cyan patches train the calibration; violet patches are held out for
                independent validation. Patch coordinates are original image pixels. With
                the preview focused: <span className="mono text-txt-2">Enter</span> adds a
                small centred patch,{' '}
                <span className="mono text-txt-2">Delete</span> removes the last one.
                Patches must land on a physical reference standard with published values —
                arbitrary image regions cannot be calibrated against.
            </p>
        </div>
    );
}
