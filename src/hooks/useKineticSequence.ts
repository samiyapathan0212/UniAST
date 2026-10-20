/**
 * Image-sequence state for the Kinetic Analysis workspace.
 *
 * Holds one entry per selected image: its File, object URL, assigned elapsed
 * time, decode status/dimensions, and — after processing — the ROI
 * measurement. All pixel work stays in the browser; object URLs are revoked
 * on remove / clear / unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoiRect } from '../types';
import { applyCalibration, type CalibrationModel } from '../utils/calibration';
import { computeRoiStatistics } from '../utils/roiStatistics';
import type { CalibrationChoice } from '../utils/kinetics';
import {
    ACCEPTED_IMAGE_LABEL,
    ACCEPTED_IMAGE_TYPES,
} from './useImageWorkspace';

const EXTENSION_FALLBACK = /\.(png|jpe?g|webp)$/i;

export type FrameStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface SequenceFrame {
    id: string;
    file: File;
    objectUrl: string;
    fileName: string;
    fileSize: number;
    timeMin: number;
    status: FrameStatus;
    width: number;
    height: number;
    error: string | null;
    frameWarnings: string[];
}

export interface UseKineticSequence {
    frames: SequenceFrame[];
    sequenceError: string | null;
    addFiles: (files: FileList | File[]) => void;
    setFrameTime: (id: string, timeMin: number) => void;
    removeFrame: (id: string) => void;
    clearSequence: () => void;
}

/** Decode one image file just far enough to learn its dimensions. */
function probeImage(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const probe = new Image();
        probe.onload = () =>
            resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => reject(new Error('decode-failed'));
        probe.src = url;
    });
}

let nextFrameId = 1;

export function useKineticSequence(): UseKineticSequence {
    const [frames, setFrames] = useState<SequenceFrame[]>([]);
    const [sequenceError, setSequenceError] = useState<string | null>(null);
    const urlsRef = useRef<Set<string>>(new Set());
    const loadIdRef = useRef(0);

    const revokeUrl = useCallback((url: string) => {
        if (urlsRef.current.has(url)) {
            urlsRef.current.delete(url);
            URL.revokeObjectURL(url);
        }
    }, []);

    const addFiles = useCallback(
        (files: FileList | File[]) => {
            const list = Array.from(files);
            if (list.length === 0) return;
            const loadId = ++loadIdRef.current;

            const accepted: File[] = [];
            const rejected: string[] = [];
            for (const file of list) {
                const typeOk =
                    ACCEPTED_IMAGE_TYPES.includes(file.type) ||
                    (file.type === '' && EXTENSION_FALLBACK.test(file.name));
                if (!typeOk || file.size === 0) rejected.push(file.name);
                else accepted.push(file);
            }
            setSequenceError(
                rejected.length > 0
                    ? `Skipped ${rejected.length} unsupported file(s): ${rejected.join(', ')}. Accepted formats: ${ACCEPTED_IMAGE_LABEL}.`
                    : null,
            );
            if (accepted.length === 0) return;

            const entries: SequenceFrame[] = accepted.map((file) => {
                const objectUrl = URL.createObjectURL(file);
                urlsRef.current.add(objectUrl);
                return {
                    id: `frame-${nextFrameId++}`,
                    file,
                    objectUrl,
                    fileName: file.name,
                    fileSize: file.size,
                    timeMin: 0,
                    status: 'loading' as FrameStatus,
                    width: 0,
                    height: 0,
                    error: null,
                    frameWarnings: [],
                };
            });

            setFrames((current) => {
                const baseTime =
                    current.length > 0 ? Math.max(...current.map((f) => f.timeMin)) : -30;
                return [
                    ...current,
                    ...entries.map((entry, i) => ({ ...entry, timeMin: baseTime + 30 * (i + 1) })),
                ];
            });

            void (async () => {
                const settled = await Promise.allSettled(
                    entries.map((entry) => probeImage(entry.objectUrl)),
                );
                if (loadId !== loadIdRef.current) {
                    for (const entry of entries) revokeUrl(entry.objectUrl);
                    return;
                }
                setFrames((current) =>
                    current.map((frame) => {
                        const idx = entries.findIndex((e) => e.id === frame.id);
                        if (idx === -1) return frame;
                        const result = settled[idx];
                        if (result.status === 'fulfilled') {
                            return {
                                ...frame,
                                status: 'ready',
                                width: result.value.width,
                                height: result.value.height,
                            };
                        }
                        return {
                            ...frame,
                            status: 'error',
                            error: `“${frame.fileName}” could not be decoded. The file may be corrupted or truncated.`,
                        };
                    }),
                );
            })();
        },
        [revokeUrl],
    );

    const setFrameTime = useCallback((id: string, timeMin: number) => {
        setFrames((current) =>
            current.map((frame) => (frame.id === id ? { ...frame, timeMin } : frame)),
        );
    }, []);

    const removeFrame = useCallback(
        (id: string) => {
            setFrames((current) => {
                const target = current.find((frame) => frame.id === id);
                if (target) revokeUrl(target.objectUrl);
                return current.filter((frame) => frame.id !== id);
            });
        },
        [revokeUrl],
    );

    const clearSequence = useCallback(() => {
        loadIdRef.current += 1;
        for (const url of Array.from(urlsRef.current)) revokeUrl(url);
        setFrames([]);
        setSequenceError(null);
    }, [revokeUrl]);

    useEffect(
        () => () => {
            loadIdRef.current += 1;
            for (const url of Array.from(urlsRef.current)) {
                urlsRef.current.delete(url);
                URL.revokeObjectURL(url);
            }
        },
        [],
    );

    return { frames, sequenceError, addFiles, setFrameTime, removeFrame, clearSequence };
}

export interface ProcessOptions {
    roi: RoiRect;
    calibrationChoice: CalibrationChoice;
    model: CalibrationModel | null;
}

export interface ProcessedRow {
    timeMin: number;
    source: string;
    meanR: number;
    meanG: number;
    meanB: number;
    meanLuminance: number;
    roi: RoiRect;
    resampled: boolean;
    calibrated: boolean;
    warnings: string[];
}

function decodeFrame(url: string, fileName: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`decode-failed:${fileName}`));
        image.src = url;
    });
}

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/**
 * Measure every eligible ready frame with the shared ROI (original-image
 * pixels). Frames whose dimensions differ from the reference are measured
 * only when their id is in `allowMismatchedIds` — and even then carry an
 * explicit dimension warning. Sequential so long sequences cannot spike
 * memory with parallel decodes.
 */
export async function processSequenceFrames(
    frames: Array<{
        id: string;
        fileName: string;
        objectUrl: string;
        timeMin: number;
        status: string;
        width: number;
        height: number;
        frameWarnings: string[];
    }>,
    reference: { width: number; height: number },
    options: ProcessOptions,
    allowMismatchedIds: Set<string>,
): Promise<{ rows: ProcessedRow[]; errors: string[]; processedCount: number }> {
    const rows: ProcessedRow[] = [];
    const errors: string[] = [];
    let processedCount = 0;

    const calibratedAvailable =
        options.calibrationChoice === 'calibrated' &&
        options.model !== null &&
        options.model.available;

    for (const frame of frames) {
        if (frame.status !== 'ready') continue;
        const mismatched =
            frame.width !== reference.width || frame.height !== reference.height;
        if (mismatched && !allowMismatchedIds.has(frame.id)) continue;

        try {
            const image = await decodeFrame(frame.objectUrl, frame.fileName);
            const stats = computeRoiStatistics(image, options.roi);
            if (!stats) {
                errors.push(`"${frame.fileName}": ROI statistics could not be read — frame skipped.`);
                continue;
            }
            let { meanR, meanG, meanB } = stats;
            let calibratedFlag = false;
            const warnings = [...frame.frameWarnings];
            if (options.calibrationChoice === 'calibrated') {
                if (options.model && options.model.available) {
                    const applied = applyCalibration(options.model, {
                        r: stats.meanR,
                        g: stats.meanG,
                        b: stats.meanB,
                    });
                    if (applied) {
                        meanR = applied.corrected.r;
                        meanG = applied.corrected.g;
                        meanB = applied.corrected.b;
                        calibratedFlag = true;
                        if (applied.clipped) {
                            warnings.push(
                                `corrected value(s) clipped to [0, 255] (${applied.clippedChannels.join(', ').toUpperCase()}).`,
                            );
                        }
                    }
                }
            }
            const meanLuminance = LUMA_R * meanR + LUMA_G * meanG + LUMA_B * meanB;
            if (mismatched) {
                warnings.push(
                    `dimensions ${frame.width}x${frame.height}px differ from reference ${reference.width}x${reference.height}px — same ROI coordinates applied after explicit approval.`,
                );
            }
            rows.push({
                timeMin: frame.timeMin,
                source: frame.fileName,
                meanR,
                meanG,
                meanB,
                meanLuminance,
                roi: { ...options.roi },
                resampled: stats.resampled,
                calibrated: calibratedFlag,
                warnings,
            });
            processedCount += 1;
        } catch {
            errors.push(`"${frame.fileName}": failed to decode during processing — frame skipped.`);
        }
    }

    if (options.calibrationChoice === 'calibrated' && !calibratedAvailable) {
        errors.push(
            'Calibrated mode was requested but no fitted calibration model is available — values were processed as raw.',
        );
    }

    return { rows, errors, processedCount };
}
