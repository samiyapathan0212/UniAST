import { useMemo, useRef, useState } from 'react';
import { AnalysisPersistencePanel } from '../components/AnalysisPersistencePanel';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { GlassCard } from '../components/GlassCard';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';
import { CalibrationCanvas } from '../components/calibration/CalibrationCanvas';
import { CalibrationResult } from '../components/calibration/CalibrationResult';
import { PatchTable } from '../components/calibration/PatchTable';
import { ImageUploader } from '../components/image-workspace/ImageUploader';
import { useImageWorkspace } from '../hooks/useImageWorkspace';
import type { CalibrationPatch, RoiRect } from '../types';
import {
    fitCalibration,
    residualSummary,
    type CalibrationModel,
    type ReferenceSample,
} from '../utils/calibration';
import { computeRoiStatistics } from '../utils/roiStatistics';
import {
    getAnalysisRecord,
    saveAnalysisRecord,
    type CalibrationPayload,
    type CalibrationRecord as SavedCalibration,
} from '../services/sessions';
import { CALIBRATION_METHOD_VERSION } from '../utils/calibration';

const STEPS = [
    'Select image',
    'Select reference patches',
    'Enter reference values',
    'Fit & compare',
];

const inRange = (value: number | null) =>
    value !== null && Number.isFinite(value) && value >= 0 && value <= 255;

/** A patch reference counts only when complete, in-range and standard-named. */
function isCompleteReference(patch: CalibrationPatch): boolean {
    const { r, g, b } = patch.reference;
    return inRange(r) && inRange(g) && inRange(b) && patch.standard.trim().length > 0;
}

/** Calibration workspace: reference patches → affine fit → comparison. */
export function CalibrationPage() {
    const workspace = useImageWorkspace();
    const { status, errorMessage, imageInfo, objectUrl } = workspace;

    const [patches, setPatches] = useState<CalibrationPatch[]>([]);
    const [model, setModel] = useState<CalibrationModel | null>(null);
    const [stale, setStale] = useState(false);
    const [compareId, setCompareId] = useState<string | null>(null);
    const [patchError, setPatchError] = useState<string | null>(null);
    const nextIdRef = useRef(1);

    const ready =
        status === 'ready' &&
        objectUrl !== null &&
        imageInfo !== null &&
        imageInfo.width > 0;

    const [fitNotice, setFitNotice] = useState<string | null>(null);
    const [savedCalibration, setSavedCalibration] = useState<SavedCalibration | null>(null);

    const fitPatches = useMemo(
        () => patches.filter((patch) => patch.role === 'fit'),
        [patches],
    );
    const completeFitPatches = useMemo(
        () => fitPatches.filter(isCompleteReference),
        [fitPatches],
    );
    const validationPatches = useMemo(
        () =>
            patches.filter(
                (patch) => patch.role === 'validation' && isCompleteReference(patch),
            ),
        [patches],
    );
    const incompleteCount = useMemo(
        () => patches.filter((patch) => !isCompleteReference(patch)).length,
        [patches],
    );

    const fitSamples: ReferenceSample[] = useMemo(
        () =>
            completeFitPatches.map((patch) => ({
                measured: {
                    r: patch.measured.meanR,
                    g: patch.measured.meanG,
                    b: patch.measured.meanB,
                },
                reference: {
                    r: patch.reference.r as number,
                    g: patch.reference.g as number,
                    b: patch.reference.b as number,
                },
            })),
        [completeFitPatches],
    );
    const validationSamples: ReferenceSample[] = useMemo(
        () =>
            validationPatches.map((patch) => ({
                measured: {
                    r: patch.measured.meanR,
                    g: patch.measured.meanG,
                    b: patch.measured.meanB,
                },
                reference: {
                    r: patch.reference.r as number,
                    g: patch.reference.g as number,
                    b: patch.reference.b as number,
                },
            })),
        [validationPatches],
    );

    const fitSummary = useMemo(
        () => (model ? residualSummary(model, fitSamples) : null),
        [model, fitSamples],
    );
    const validationSummary = useMemo(
        () => (model ? residualSummary(model, validationSamples) : null),
        [model, validationSamples],
    );
    const comparePatch =
        patches.find((patch) => patch.id === compareId) ??
        patches.find((patch) => isCompleteReference(patch)) ??
        null;

    const activeStep = !ready
        ? 0
        : patches.length === 0
          ? 1
          : incompleteCount > 0 || completeFitPatches.length < 2
              ? 2
              : 3;

    const markStale = () => {
        setSavedCalibration(null);
        if (model) setStale(true);
    };

    const handleFileSelected = (file: File) => {
        setSavedCalibration(null);
        workspace.loadFile(file);
        setPatches([]);
        setModel(null);
        setStale(false);
        setCompareId(null);
        setPatchError(null);
        setFitNotice(null);
    };

    const handleClearImage = () => {
        setSavedCalibration(null);
        workspace.clearImage();
        setPatches([]);
        setModel(null);
        setStale(false);
        setCompareId(null);
        setPatchError(null);
        setFitNotice(null);
    };
    const handleCreatePatch = (rect: RoiRect) => {
        const image = workspace.imageRef.current;
        if (!image || image.naturalWidth === 0) {
            setPatchError(
                'The image is not decoded yet. Wait for the preview to finish loading, then draw the patch again.',
            );
            return;
        }
        const measured = computeRoiStatistics(image, rect);
        if (!measured) {
            setPatchError(
                'That patch produced no measurable pixels. Draw a larger rectangle fully inside the image.',
            );
            return;
        }
        const id = `p${nextIdRef.current}`;
        nextIdRef.current += 1;
        setPatches((previous) => [
            ...previous,
            {
                id,
                rect,
                measured,
                reference: { r: null, g: null, b: null },
                standard: '',
                role: 'fit',
            },
        ]);
        setCompareId((previous) => previous ?? id);
        setPatchError(null);
        markStale();
    };

    const handleUpdatePatch = (
        id: string,
        update: Partial<Pick<CalibrationPatch, 'reference' | 'standard' | 'role'>>,
    ) => {
        setPatches((previous) =>
            previous.map((patch) =>
                patch.id === id ? { ...patch, ...update } : patch,
            ),
        );
        markStale();
    };

    const handleRemovePatch = (id: string) => {
        setPatches((previous) => previous.filter((patch) => patch.id !== id));
        setCompareId((previous) => (previous === id ? null : previous));
        markStale();
    };

    const handleRemoveLastPatch = () => {
        setPatches((previous) => {
            if (previous.length === 0) return previous;
            const removed = previous[previous.length - 1];
            setCompareId((current) => (current === removed.id ? null : current));
            return previous.slice(0, -1);
        });
        markStale();
    };

    const handleClearPatches = () => {
        setPatches([]);
        setCompareId(null);
        setPatchError(null);
        markStale();
    };

    const handleFit = () => {
        setFitNotice(null);
        if (fitPatches.length < 2) {
            setPatchError(
                `Calibration needs at least two patches on the “Calibration fit” role (currently ${fitPatches.length}). Draw more rectangles on the reference standard or switch validation patches back to the fit role.`,
            );
            return;
        }
        if (completeFitPatches.length < 2) {
            const missing = fitPatches.length - completeFitPatches.length;
            setPatchError(
                `Only ${completeFitPatches.length} of ${fitPatches.length} fit patches are complete. Enter a 0–255 reference R, G and B plus the standard description for each of the ${missing} incomplete patch${missing === 1 ? '' : 'es'} before fitting.`,
            );
            return;
        }
        const next = fitCalibration(fitSamples);
        setModel(next);
        setStale(false);
        if (!next.available) {
            const degenerate = (['r', 'g', 'b'] as const)
                .filter((channel) => next[channel].status !== 'ok')
                .map((channel) => channel.toUpperCase())
                .join(', ');
            setPatchError(
                `The fit is degenerate on channel(s) ${degenerate}: the fit patches share (near-)identical measured values there, so no slope can be determined. Add patches spanning darker and brighter reference tones.`,
            );
        } else {
            setPatchError(null);
            setFitNotice(
                `Calibration fitted on ${next.fitPatchCount} reference patch${next.fitPatchCount === 1 ? '' : 'es'}. Residuals below describe the fit set only — they are not independent validation.`,
            );
        }
    };

    const handleResetCalibration = () => {
        setModel(null);
        setStale(false);
        setFitNotice(null);
    };

    const handleSaveCalibration = async (sessionId: string) => {
        if (!ready || !imageInfo || !model || stale || incompleteCount > 0) return;
        const patchesToSave = patches.filter(isCompleteReference).map((patch) => ({
            patchId: patch.id,
            roi: patch.rect,
            measured: patch.measured,
            reference: {
                r: patch.reference.r as number,
                g: patch.reference.g as number,
                b: patch.reference.b as number,
            },
            standard: patch.standard.trim(),
            role: patch.role,
        }));
        const toStoredSummary = (summary: typeof fitSummary) => {
            if (!summary) return null;
            if (summary.meanLuminanceError === null) {
                throw new Error('Calibration error summary is incomplete and cannot be saved.');
            }
            return { ...summary, meanLuminanceError: summary.meanLuminanceError };
        };
        const payload: CalibrationPayload = {
            sourceMetadata: {
                fileName: imageInfo.fileName,
                mimeType: imageInfo.mimeType,
                fileSize: imageInfo.fileSize,
                width: imageInfo.width,
                height: imageInfo.height,
            },
            patches: patchesToSave,
            model,
            fitErrorSummary: toStoredSummary(fitSummary),
            validationErrorSummary: toStoredSummary(validationSummary),
            methodVersion: CALIBRATION_METHOD_VERSION,
        };
        await saveAnalysisRecord<CalibrationPayload, SavedCalibration>(sessionId, 'calibrations', payload);
    };

    const handleLoadCalibration = async (sessionId: string, recordId: string) => {
        const record = await getAnalysisRecord<SavedCalibration>(sessionId, 'calibrations', recordId);
        setSavedCalibration(record);
        setPatches(record.patches.map((patch) => ({
            id: patch.patchId,
            rect: patch.roi,
            measured: patch.measured,
            reference: patch.reference,
            standard: patch.standard,
            role: patch.role,
        })));
        setModel(record.model);
        setStale(false);
        setFitNotice('Loaded saved calibration result. The source image itself is not stored or restored.');
        setPatchError(null);
        setCompareId(null);
    };
    return (
        <div>
            <PageHeader
                title={
                    <>
                        Optical calibration
                        <Badge tone="pending">EXPERIMENTAL RESEARCH PROTOTYPE</Badge>
                    </>
                }
                subtitle="Measure patches with known colours, fit a per-channel correction, and compare raw versus corrected measurements. All processing stays in your browser."
            >
                {ready ? (
                    <Button variant="danger" size="sm" onClick={handleClearImage}>
                        Start over
                    </Button>
                ) : null}
            </PageHeader>

            <ol
                aria-label="Calibration steps"
                className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
            >
                {STEPS.map((label, index) => {
                    const state =
                        index < activeStep ? 'done' : index === activeStep ? 'now' : 'todo';
                    return (
                        <li
                            key={label}
                            aria-current={state === 'now' ? 'step' : undefined}
                            className={[
                                'flex items-center gap-3 rounded-lg border px-4 py-3',
                                state === 'now'
                                    ? 'border-[rgba(0,242,254,0.45)] bg-[rgba(0,242,254,0.08)]'
                                    : 'border-line bg-[rgba(10,20,42,0.45)]',
                            ].join(' ')}
                        >
                            <span
                                className={[
                                    'mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold',
                                    state === 'done'
                                        ? 'border-[rgba(16,185,129,0.5)] bg-[rgba(16,185,129,0.15)] text-[#6ee7b7]'
                                        : state === 'now'
                                          ? 'border-cyan bg-[rgba(0,242,254,0.15)] text-cyan'
                                          : 'border-line text-txt-muted',
                                ].join(' ')}
                            >
                                {state === 'done' ? '✓' : index + 1}
                            </span>
                            <span
                                className={`text-[13px] font-semibold ${state === 'todo' ? 'text-txt-muted' : 'text-white'}`}
                            >
                                {label}
                            </span>
                        </li>
                    );
                })}
            </ol>
            <p className="mb-6 max-w-[860px] rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)] px-4 py-3 text-[12.5px] leading-relaxed text-[#cbd5e1]">
                A meaningful calibration requires a <strong className="text-[#fde68a]">physical reference standard with published values</strong>{' '}
                (for example a printed colour chart) photographed under the same
                illumination. Arbitrary image regions are not valid standards.
            </p>
            {savedCalibration ? (
                <p role="status" className="mb-5 rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.04)] px-4 py-3 text-[12.5px] text-txt-2">
                    Loaded saved result for <strong>{savedCalibration.sourceMetadata.fileName}</strong>. Calibration values and patch metadata are shown; the original image was not stored.
                </p>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-2">
                <GlassCard glow title="1 · Source image">
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
                        <div className="mono mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[12px] text-txt-muted">
                            <span className="max-w-full truncate font-medium text-txt">
                                {imageInfo.fileName}
                            </span>
                            <span>{formatBytes(imageInfo.fileSize)}</span>
                            <span>
                                {imageInfo.width} × {imageInfo.height} px
                            </span>
                        </div>
                    ) : null}
                </GlassCard>

                <GlassCard
                    glow
                    title="2 · Reference patches"
                    action={
                        <span className="mono text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                            original-pixel coordinates
                        </span>
                    }
                >
                    {ready && objectUrl && imageInfo ? (
                        <CalibrationCanvas
                            objectUrl={objectUrl}
                            imageRef={workspace.imageRef}
                            naturalWidth={imageInfo.width}
                            naturalHeight={imageInfo.height}
                            patches={patches}
                            onCreatePatch={handleCreatePatch}
                            onRemoveLastPatch={handleRemoveLastPatch}
                            onClearPatches={handleClearPatches}
                        />
                    ) : (
                        <EmptyState
                            title="Load an image first"
                            description="Choose a PNG, JPEG or WebP photograph of your physical reference standard above. Patch selection unlocks once the preview is decoded."
                        />
                    )}
                </GlassCard>
            </div>
            <GlassCard glow title="3 · Reference values & roles" className="mt-5">
                <p className="mb-4 max-w-[860px] text-[13px] leading-relaxed text-txt-2">
                    Enter the <strong className="text-white">known reference R, G, B (0–255)</strong> for
                    each patch plus the standard it represents. Keep patches on{' '}
                    <span className="mono text-cyan">calibration-fit</span> to train the model;
                    switch some to <span className="mono text-violet">held-out validation</span> to
                    test it independently.
                </p>
                <PatchTable
                    patches={patches}
                    compareId={compareId}
                    onCompare={setCompareId}
                    onUpdate={handleUpdatePatch}
                    onRemove={handleRemovePatch}
                />
                <div
                    className="mono mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-txt-muted"
                    aria-live="polite"
                >
                    <span>
                        {completeFitPatches.length} / {fitPatches.length} fit patches complete
                    </span>
                    <span>{validationPatches.length} validation patches complete</span>
                    {incompleteCount > 0 ? (
                        <span className="text-[#fde68a]">
                            {incompleteCount} need reference values / standard
                        </span>
                    ) : null}
                </div>
            </GlassCard>
            <GlassCard glow title="4 · Fit calibration & compare" className="mt-5">
                <div className="mb-4 flex flex-wrap gap-3">
                    <Button
                        variant="primary"
                        onClick={handleFit}
                        disabled={!ready || patches.length === 0}
                    >
                        Fit calibration
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleResetCalibration}
                        disabled={!model}
                    >
                        Reset calibration
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleClearPatches}
                        disabled={patches.length === 0}
                    >
                        Clear patches
                    </Button>
                </div>

                {patchError ? (
                    <p
                        role="alert"
                        className="mb-4 rounded-lg border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-[13px] leading-relaxed text-[#fecaca]"
                    >
                        {patchError}
                    </p>
                ) : null}
                {fitNotice ? (
                    <p className="mb-4 rounded-lg border border-[rgba(0,242,254,0.35)] bg-[rgba(0,242,254,0.07)] px-4 py-3 text-[13px] leading-relaxed text-txt-2">
                        {fitNotice}
                    </p>
                ) : null}
                {stale && model ? (
                    <p className="mb-4 rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-[13px] leading-relaxed text-[#fde68a]">
                        Patches changed since the last fit — the numbers below describe
                        the previous fit. Press “Fit calibration” again to update.
                    </p>
                ) : null}

                {!model ? (
                    <EmptyState
                        title="No calibration fitted yet"
                        description="Add at least two complete calibration-fit patches (measured values plus known reference RGB and the standard they represent), then press “Fit calibration”."
                    />
                ) : (
                    <CalibrationResult
                        model={model}
                        fitSummary={fitSummary}
                        validationSummary={validationSummary}
                        validationPatchCount={validationPatches.length}
                        comparePatch={comparePatch}
                    />
                )}
            </GlassCard>
            <div className="mt-5">
                <AnalysisPersistencePanel
                    kind="calibrations"
                    title="Save or load calibration"
                    canSave={ready && Boolean(model) && !stale && incompleteCount === 0}
                    disabledReason="Load a source image, complete all patches, fit a valid model, and save before changing patches."
                    onSave={handleSaveCalibration}
                    onLoad={handleLoadCalibration}
                />
            </div>
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
    return `${(kilobytes / 1024).toFixed(2)} MB`;
}
