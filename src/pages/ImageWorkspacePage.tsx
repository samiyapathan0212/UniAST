import { useState } from 'react';
import { AnalysisPersistencePanel } from '../components/AnalysisPersistencePanel';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { GlassCard } from '../components/GlassCard';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { ImageCanvas } from '../components/image-workspace/ImageCanvas';
import { ImageUploader } from '../components/image-workspace/ImageUploader';
import { RoiStatistics } from '../components/image-workspace/RoiStatistics';
import { useImageWorkspace } from '../hooks/useImageWorkspace';
import type { RoiRect } from '../types';
import {
    getAnalysisRecord,
    saveAnalysisRecord,
    type ImageAnalysisPayload,
    type ImageAnalysisRecord as SavedImageAnalysis,
} from '../services/sessions';
import { IMAGE_ANALYSIS_METHOD_VERSION } from '../utils/roiStatistics';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
    return `${(kilobytes / 1024).toFixed(2)} MB`;
}

/**
 * Image Workspace (Milestone 2): in-browser upload, preview, manual ROI
 * selection and image-derived optical statistics. No pixel data ever leaves
 * the browser and no clinical interpretation is performed.
 */
export function ImageWorkspacePage() {
    const workspace = useImageWorkspace();
    const [savedAnalysis, setSavedAnalysis] = useState<SavedImageAnalysis | null>(null);
    const { status, errorMessage, imageInfo, objectUrl, roi, stats, statsBusy } =
        workspace;

    const ready =
        status === 'ready' &&
        objectUrl !== null &&
        imageInfo !== null &&
        imageInfo.width > 0;
    const displayRoi = savedAnalysis?.roi ?? roi;
    const displayStats = savedAnalysis?.statistics ?? stats;

    const handleFileSelected = (file: File) => {
        setSavedAnalysis(null);
        workspace.loadFile(file);
    };

    const handleClearImage = () => {
        setSavedAnalysis(null);
        workspace.clearImage();
    };

    const handleRoiChange = (next: RoiRect | null) => {
        setSavedAnalysis(null);
        workspace.setRoi(next);
    };

    const handleClearRoi = () => {
        setSavedAnalysis(null);
        workspace.clearRoi();
    };

    const handleResetRoi = () => {
        setSavedAnalysis(null);
        workspace.resetRoi();
    };

    const handleSaveAnalysis = async (sessionId: string) => {
        if (!ready || !imageInfo || !roi || !stats) return;
        const payload: ImageAnalysisPayload = {
            sourceMetadata: {
                fileName: imageInfo.fileName,
                mimeType: imageInfo.mimeType,
                fileSize: imageInfo.fileSize,
                width: imageInfo.width,
                height: imageInfo.height,
            },
            roi,
            statistics: stats,
            methodVersion: IMAGE_ANALYSIS_METHOD_VERSION,
        };
        await saveAnalysisRecord<ImageAnalysisPayload, SavedImageAnalysis>(
            sessionId,
            'image-analyses',
            payload,
        );
    };

    const handleLoadAnalysis = async (sessionId: string, recordId: string) => {
        const record = await getAnalysisRecord<SavedImageAnalysis>(sessionId, 'image-analyses', recordId);
        setSavedAnalysis(record);
    };

    return (
        <div>
            <PageHeader
                title={
                    <>
                        Image workspace
                        <Badge tone="cyan">IN-BROWSER ONLY</Badge>
                    </>
                }
                subtitle="Load a panel photograph, drag out a rectangular region of interest, and read image-derived colour and luminance statistics. Files are decoded locally — nothing is uploaded."
            >
                {ready ? (
                    <Button variant="danger" size="sm" onClick={handleClearImage}>
                        Remove image
                    </Button>
                ) : null}
            </PageHeader>

            <div className="grid gap-5 lg:grid-cols-3">
                {/* --- Left column: upload + preview ------------------------- */}
                <div className="flex flex-col gap-5 lg:col-span-2">
                    <GlassCard glow title="Source image">
                        <ImageUploader
                            onFileSelected={handleFileSelected}
                            error={status === 'error' ? errorMessage : null}
                            busy={status === 'loading'}
                        />

                        {status === 'loading' ? (
                            <div className="mt-4">
                                <LoadingState
                                    variant="list"
                                    count={1}
                                    label="Decoding image…"
                                />
                            </div>
                        ) : null}

                        {ready && imageInfo ? (
                            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-[rgba(255,255,255,0.03)] px-4 py-3">
                                <span className="flex min-w-0 items-center gap-2 text-[13px] text-txt">
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        className="shrink-0 text-cyan"
                                        aria-hidden="true"
                                    >
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <path d="m21 15-5-5L5 21" />
                                    </svg>
                                    <span className="truncate font-medium">
                                        {imageInfo.fileName}
                                    </span>
                                </span>
                                <span className="mono text-[12px] text-txt-muted">
                                    {formatBytes(imageInfo.fileSize)}
                                </span>
                                <span className="mono text-[12px] text-txt-muted">
                                    {imageInfo.width} × {imageInfo.height} px
                                </span>
                            </div>
                        ) : null}
                    </GlassCard>

                    <GlassCard
                        glow
                        title="Region of interest"
                        action={
                            <span className="mono text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                                original-pixel coordinates
                            </span>
                        }
                    >
                        {ready && objectUrl && imageInfo ? (
                            <ImageCanvas
                                objectUrl={objectUrl}
                                imageRef={workspace.imageRef}
                                naturalWidth={imageInfo.width}
                                naturalHeight={imageInfo.height}
                                roi={roi}
                                onRoiChange={handleRoiChange}
                                onClearRoi={handleClearRoi}
                                onResetRoi={handleResetRoi}
                            />
                        ) : (
                            <EmptyState
                                title="No image loaded"
                                description="Upload a PNG, JPEG or WebP image above to enable the preview and ROI selection. Unsupported or corrupted files are reported with an error."
                            />
                        )}
                    </GlassCard>
                </div>

                {/* --- Right column: statistics ------------------------------ */}
                <div className="lg:col-span-1">
                    <GlassCard
                        glow
                        className="h-full"
                        title="ROI statistics"
                        action={
                            <span className="mono text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                                pixel sampling
                            </span>
                        }
                    >
                        {savedAnalysis ? (
                            <p className="mb-3 rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.04)] px-3 py-2 text-[12px] text-txt-2">
                                Loaded saved result for <strong>{savedAnalysis.sourceMetadata.fileName}</strong>. The source image itself is not stored or restored.
                            </p>
                        ) : null}
                        <RoiStatistics roi={displayRoi} stats={displayStats} busy={statsBusy && !savedAnalysis} />
                    </GlassCard>
                </div>
            </div>
            <div className="mt-5">
                <AnalysisPersistencePanel
                    kind="image-analyses"
                    title="Save or load image analysis"
                    canSave={ready && Boolean(roi && stats) && !statsBusy}
                    disabledReason="Load an image, select an ROI, and wait for statistics before saving."
                    onSave={handleSaveAnalysis}
                    onLoad={handleLoadAnalysis}
                />
            </div>
        </div>
    );
}
