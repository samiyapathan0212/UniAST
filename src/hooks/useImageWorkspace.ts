import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { RoiRect, RoiStatistics } from '../types';
import { computeRoiStatistics } from '../utils/roiStatistics';

/** Browser-readable formats accepted by the workspace. */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ACCEPTED_IMAGE_LABEL = 'PNG, JPEG or WebP';
const ACCEPTED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export type WorkspaceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ImageInfo {
    fileName: string;
    mimeType: string;
    fileSize: number;
    width: number;
    height: number;
}

export interface UseImageWorkspace {
    status: WorkspaceStatus;
    errorMessage: string | null;
    imageInfo: ImageInfo | null;
    objectUrl: string | null;
    roi: RoiRect | null;
    stats: RoiStatistics | null;
    statsBusy: boolean;
    /** Attach to the rendered <img> so statistics read the decoded pixels. */
    imageRef: RefObject<HTMLImageElement | null>;
    loadFile: (file: File) => void;
    clearImage: () => void;
    setRoi: (rect: RoiRect | null) => void;
    clearRoi: () => void;
    resetRoi: () => void;
}

/**
 * Image lifecycle + ROI state for the Image Workspace.
 *
 * - Accepts PNG / JPEG / WebP only; other files produce a readable error.
 * - Keeps exactly one object URL alive at a time and revokes it on replace,
 *   clear and unmount (images never leave the browser).
 * - Recomputes ROI statistics whenever the selection changes.
 */
export function useImageWorkspace(): UseImageWorkspace {
    const [status, setStatus] = useState<WorkspaceStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [roi, setRoiState] = useState<RoiRect | null>(null);
    const [stats, setStats] = useState<RoiStatistics | null>(null);
    const [statsBusy, setStatsBusy] = useState(false);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const urlRef = useRef<string | null>(null);
    const loadIdRef = useRef(0);

    const revokeCurrentUrl = useCallback(() => {
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
    }, []);

    const loadFile = useCallback(
        (file: File) => {
            const loadId = ++loadIdRef.current;

            const typeOk =
                ACCEPTED_IMAGE_TYPES.includes(file.type) ||
                (file.type === '' && ACCEPTED_EXTENSIONS.test(file.name));

            if (!typeOk) {
                revokeCurrentUrl();
                setObjectUrl(null);
                setImageInfo(null);
                setRoiState(null);
                setStats(null);
                setStatus('error');
                setErrorMessage(
                    `“${file.name}” is not a supported image type. Please choose a ${ACCEPTED_IMAGE_LABEL} file.`,
                );
                return;
            }

            if (file.size === 0) {
                revokeCurrentUrl();
                setObjectUrl(null);
                setStatus('error');
                setErrorMessage(`“${file.name}” is empty (0 bytes) and cannot be decoded.`);
                return;
            }

            revokeCurrentUrl();
            const url = URL.createObjectURL(file);
            urlRef.current = url;

            setErrorMessage(null);
            setImageInfo({
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                fileSize: file.size,
                width: 0,
                height: 0,
            });
            setRoiState(null);
            setStats(null);
            setObjectUrl(url);
            setStatus('loading');

            const probe = new Image();
            probe.onload = () => {
                if (loadId !== loadIdRef.current) return; // superseded by a newer file
                setImageInfo({
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    fileSize: file.size,
                    width: probe.naturalWidth,
                    height: probe.naturalHeight,
                });
                setStatus('ready');
            };
            probe.onerror = () => {
                if (loadId !== loadIdRef.current) return;
                revokeCurrentUrl();
                setObjectUrl(null);
                setImageInfo(null);
                setStatus('error');
                setErrorMessage(
                    `“${file.name}” could not be decoded as an image. The file may be corrupted or truncated.`,
                );
            };
            probe.src = url;
        },
        [revokeCurrentUrl],
    );

    const clearImage = useCallback(() => {
        loadIdRef.current += 1; // cancel any in-flight decode
        revokeCurrentUrl();
        setObjectUrl(null);
        setImageInfo(null);
        setRoiState(null);
        setStats(null);
        setErrorMessage(null);
        setStatus('idle');
    }, [revokeCurrentUrl]);

    const setRoi = useCallback((rect: RoiRect | null) => {
        setRoiState(rect);
    }, []);

    const clearRoi = useCallback(() => {
        setRoiState(null);
        setStats(null);
    }, []);

    const resetRoi = useCallback(() => {
        const image = imageRef.current;
        if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
            setRoiState({
                x: 0,
                y: 0,
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        }
    }, []);

    // Recompute statistics whenever the selection (or image) changes.
    useEffect(() => {
        if (!roi || status !== 'ready') {
            setStats(null);
            setStatsBusy(false);
            return;
        }
        setStatsBusy(true);
        const timer = window.setTimeout(() => {
            const image = imageRef.current;
            const next =
                image && image.complete && image.naturalWidth > 0
                    ? computeRoiStatistics(image, roi)
                    : null;
            setStats(next);
            setStatsBusy(false);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [roi, status, objectUrl]);

    // Release the object URL when the workspace unmounts.
    useEffect(() => {
        return () => {
            loadIdRef.current += 1;
            if (urlRef.current) {
                URL.revokeObjectURL(urlRef.current);
                urlRef.current = null;
            }
        };
    }, []);

    return {
        status,
        errorMessage,
        imageInfo,
        objectUrl,
        roi,
        stats,
        statsBusy,
        imageRef,
        loadFile,
        clearImage,
        setRoi,
        clearRoi,
        resetRoi,
    };
}
