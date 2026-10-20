import type { RoiRect } from '../types';

/** Shared ROI geometry helpers (used by the Image Workspace and Calibration canvases). */

export const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

/** Normalise two drag points into a positive-size rectangle. */
export function normalizeRect(
    ax: number,
    ay: number,
    bx: number,
    by: number,
): RoiRect {
    return {
        x: Math.min(ax, bx),
        y: Math.min(ay, by),
        width: Math.abs(bx - ax),
        height: Math.abs(by - ay),
    };
}

/** Round and clamp a rectangle to the image bounds (original pixels). */
export function clampRect(
    rect: RoiRect,
    naturalWidth: number,
    naturalHeight: number,
): RoiRect {
    const x = clamp(Math.floor(rect.x), 0, naturalWidth - 1);
    const y = clamp(Math.floor(rect.y), 0, naturalHeight - 1);
    const width = clamp(Math.ceil(rect.width), 1, naturalWidth - x);
    const height = clamp(Math.ceil(rect.height), 1, naturalHeight - y);
    return { x, y, width, height };
}

interface ViewRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** Convert viewport client coordinates to ORIGINAL image pixels (clamped). */
export function clientToImagePoint(
    clientX: number,
    clientY: number,
    stageRect: ViewRect,
    naturalWidth: number,
    naturalHeight: number,
): { x: number; y: number } {
    const scaleX = naturalWidth / Math.max(stageRect.width, 1);
    const scaleY = naturalHeight / Math.max(stageRect.height, 1);
    return {
        x: clamp((clientX - stageRect.left) * scaleX, 0, naturalWidth),
        y: clamp((clientY - stageRect.top) * scaleY, 0, naturalHeight),
    };
}
