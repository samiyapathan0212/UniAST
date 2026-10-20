/**
 * Kinetic Analysis workspace (Milestone 4).
 *
 * Image-derived OPTICAL measurements across a time series — descriptive only.
 * Never infers bacterial identity, bacterial growth, antimicrobial
 * susceptibility, resistance, or any clinical endpoint. Slopes here are rates
 * of optical change, not growth rates.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnalysisPersistencePanel } from '../components/AnalysisPersistencePanel';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { CsvImporter } from '../components/kinetics/CsvImporter';
import { KineticSeriesChart } from '../components/kinetics/KineticSeriesChart';
import { KineticTable } from '../components/kinetics/KineticTable';
import { SequenceUploader } from '../components/kinetics/SequenceUploader';
import { ImageCanvas } from '../components/image-workspace/ImageCanvas';
import {
    processSequenceFrames,
    useKineticSequence,
    type ProcessOptions,
} from '../hooks/useKineticSequence';
import type { CalibrationModel } from '../utils/calibration';
import { clampRect } from '../utils/roiGeometry';
import {
    exportKineticsCsv,
    parseKineticCsv,
    summarizeSeries,
    validateAndDeriveSeries,
    type CalibrationChoice,
    type DerivedObservation,
    type SeriesIssue,
} from '../utils/kinetics';
import type { RoiRect } from '../types';
import {
    getAnalysisRecord,
    saveAnalysisRecord,
    type KineticAnalysisRecord as SavedKineticAnalysis,
    type KineticPayload,
} from '../services/sessions';
import { KINETIC_METHOD_VERSION } from '../utils/kinetics';

type InputMode = 'images' | 'csv';
type DatasetOrigin = 'images' | 'csv' | 'simulated' | null;

interface DatasetState {
    origin: Exclude<DatasetOrigin, null>;
    observations: DerivedObservation[];
    issues: SeriesIssue[];
    baseline: number | null;
    notices: string[];
    savedRecord?: boolean;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

/** Small fabricated series so the dashboard layout can be previewed. */
function simulatedDataset(): DatasetState {
    const seed = [
        { t: 0, l: 128.6, src: 'simulated frame t0' },
        { t: 30, l: 127.0, src: 'simulated frame t30' },
        { t: 60, l: 125.7, src: 'simulated frame t60' },
        { t: 90, l: 124.9, src: 'simulated frame t90' },
        { t: 120, l: 124.1, src: 'simulated frame t120' },
    ];
    const series = validateAndDeriveSeries(
        seed.map((p) => ({
            timeMin: p.t,
            source: p.src,
            meanR: p.l + 4,
            meanG: p.l,
            meanB: p.l - 7,
            meanLuminance: p.l,
            roi: null,
            resampled: false,
            calibrated: false,
            warnings: [],
        })),
    );
    return {
        origin: 'simulated',
        observations: series.observations,
        issues: series.issues,
        baseline: series.baselineLuminance,
        notices: ['Preview only — fabricated values. Load real images or a CSV to analyse.'],
    };
}

const STEPS = [
    { id: 'dataset', title: 'Dataset', description: 'Images or CSV' },
    { id: 'times', title: 'Times', description: 'Assign minutes' },
    { id: 'roi', title: 'ROI', description: 'Reference frame' },
    { id: 'review', title: 'Review', description: 'Plots + checks' },
    { id: 'export', title: 'Export', description: 'CSV results' },
];

const STEP_STATUS = (stepIndex: number, current: number) =>
    stepIndex < current ? 'complete' : stepIndex === current ? 'active' : 'upcoming';

/**
 * Full workspace: dataset assembly → time assignment → ROI on the reference
 * frame (+ mismatch approval) → processing → review plots/table → CSV export.
 */
export function KineticsPage() {
    const [inputMode, setInputMode] = useState<InputMode>('images');
    const [step, setStep] = useState(0);
    const [roi, setRoi] = useState<RoiRect | null>(null);
    const [referenceId, setReferenceId] = useState<string | null>(null);
    const [approvedMismatchIds, setApprovedMismatchIds] = useState<string[]>([]);
    const [calibrationChoice] = useState<CalibrationChoice>('raw');
    const [calibrationModel] = useState<CalibrationModel | null>(null);
    const [dataset, setDataset] = useState<DatasetState | null>(null);
    const [csvError, setCsvError] = useState<string | null>(null);
    const [csvNotices, setCsvNotices] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);
    const [processErrors, setProcessErrors] = useState<string[]>([]);
    const [showSimulated, setShowSimulated] = useState(false);
    const [exported, setExported] = useState(false);

    const hiddenImageRef = useRef<HTMLImageElement | null>(null);

    const seq = useKineticSequence();
    const { frames } = seq;

    const readyFrames = useMemo(
        () => frames.filter((frame) => frame.status === 'ready'),
        [frames],
    );
    const referenceFrame = useMemo(
        () =>
            readyFrames.find((frame) => frame.id === referenceId) ??
            readyFrames[0] ??
            null,
        [readyFrames, referenceId],
    );

    // Keep the ROI inside the reference frame; drop it if the frame leaves.
    useEffect(() => {
        if (!referenceFrame) {
            setRoi(null);
            return;
        }
        setReferenceId(referenceFrame.id);
        setRoi((current) => {
            if (!current) return current;
            return clampRect(current, referenceFrame.width, referenceFrame.height);
        });
    }, [referenceFrame?.id, referenceFrame?.width, referenceFrame?.height]);

    // Dimension mismatches vs the reference frame (explicit decision needed).
    const mismatches = useMemo(() => {
        if (!referenceFrame) return [];
        return readyFrames
            .filter(
                (frame) =>
                    frame.id !== referenceFrame.id &&
                    (frame.width !== referenceFrame.width ||
                        frame.height !== referenceFrame.height),
            )
            .map((frame) => ({ frame, approved: approvedMismatchIds.includes(frame.id) }));
    }, [readyFrames, referenceFrame, approvedMismatchIds]);

    const duplicateTimes = useMemo(() => {
        const counts = new Map<number, number>();
        for (const frame of frames) {
            counts.set(frame.timeMin, (counts.get(frame.timeMin) ?? 0) + 1);
        }
        return [...counts.entries()].filter(([, n]) => n > 1).map(([t]) => t);
    }, [frames]);

    const invalidTimes = useMemo(
        () => frames.filter((f) => !Number.isFinite(f.timeMin) || f.timeMin < 0),
        [frames],
    );

    const canProcess =
        roi !== null &&
        referenceFrame !== null &&
        readyFrames.length > 0 &&
        invalidTimes.length === 0 &&
        mismatches.every((m) => m.approved) &&
        !processing;

    const handleFiles = (files: FileList | File[]) => {
        setProcessErrors([]);
        setDataset(null);
        seq.addFiles(files);
    };

    const handleCsvText = (fileName: string, text: string) => {
        const parsed = parseKineticCsv(text);
        const notices: string[] = [...parsed.warnings];
        if (parsed.errors.length > 0) {
            setCsvError(
                `"${fileName}": ${parsed.errors.join(' ')}${parsed.rows.length > 0 ? ` ${parsed.rows.length} valid row(s) kept; nothing was repaired or fabricated.` : ''}`,
            );
        } else {
            setCsvError(null);
        }
        const series = validateAndDeriveSeries(
            parsed.rows.map((row) => ({
                timeMin: row.timeMin,
                source: row.source,
                meanR: row.meanR,
                meanG: row.meanG,
                meanB: row.meanB,
                meanLuminance: row.meanLuminance,
                roi: row.roi,
                resampled: row.resampled,
                calibrated: row.calibrated,
                warnings: row.warnings,
            })),
        );
        notices.push(
            ...series.issues.map((issue) => issue.message),
            ...(parsed.rows.some((row) => row.roi === null)
                ? ['Some rows carry no ROI metadata — reported as "no ROI metadata" in the table.']
                : []),
        );
        setCsvNotices(notices);
        setDataset({
            origin: 'csv',
            observations: series.observations,
            issues: series.issues,
            baseline: series.baselineLuminance,
            notices,
        });
        setExported(false);
        setStep(4);
    };

    const handleProcess = async () => {
        if (!canProcess || !referenceFrame || !roi) return;
        setProcessing(true);
        setProcessErrors([]);
        setDataset(null);
        try {
            const options: ProcessOptions = {
                roi,
                calibrationChoice,
                model: calibrationModel,
            };
            const allowMismatchedIds = new Set(approvedMismatchIds);
            const result = await processSequenceFrames(
                readyFrames,
                { width: referenceFrame.width, height: referenceFrame.height },
                options,
                allowMismatchedIds,
            );
            const derived = validateAndDeriveSeries(result.rows);
            const notices: string[] = [
                ...result.errors,
                ...derived.issues.map((i) => i.message),
            ];
            setDataset({
                origin: 'images',
                observations: derived.observations,
                issues: derived.issues,
                baseline: derived.baselineLuminance,
                notices,
            });
            setExported(false);
            setStep(4);
        } catch (err) {
            setProcessErrors([
                err instanceof Error
                    ? `Processing failed: ${err.message}`
                    : 'Processing failed: unknown error.',
            ]);
        } finally {
            setProcessing(false);
        }
    };

    const handleExport = () => {
        if (!dataset || dataset.observations.length === 0) return;
        const csv = exportKineticsCsv(
            {
                observations: dataset.observations,
                issues: dataset.issues,
                baselineLuminance: dataset.baseline,
            },
            dataset.observations.some((obs) => obs.calibrated),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `uniast_kinetics_${dataset.origin}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setExported(true);
    };

    const handleSaveKineticAnalysis = async (sessionId: string) => {
        if (!dataset || dataset.origin === 'simulated' || dataset.baseline === null || dataset.observations.length === 0) return;
        const calibratedCount = dataset.observations.filter((row) => row.calibrated).length;
        const calibrationChoice = calibratedCount === 0
            ? 'raw'
            : calibratedCount === dataset.observations.length
                ? 'calibrated'
                : 'mixed';
        const payload: KineticPayload = {
            sourceType: dataset.origin,
            calibrationChoice,
            observations: dataset.observations,
            baselineLuminance: dataset.baseline,
            issues: dataset.issues,
            warnings: dataset.notices,
            methodVersion: KINETIC_METHOD_VERSION,
        };
        await saveAnalysisRecord<KineticPayload, SavedKineticAnalysis>(sessionId, 'kinetic-analyses', payload);
    };

    const handleLoadKineticAnalysis = async (sessionId: string, recordId: string) => {
        const record = await getAnalysisRecord<SavedKineticAnalysis>(sessionId, 'kinetic-analyses', recordId);
        setInputMode(record.sourceType === 'csv' ? 'csv' : 'images');
        setDataset({
            origin: record.sourceType,
            observations: record.observations,
            issues: record.issues,
            baseline: record.baselineLuminance,
            notices: record.warnings,
            savedRecord: true,
        });
        setShowSimulated(false);
        setStep(4);
    };

    const visibleNotices = Array.from(new Set([
        ...(dataset?.notices ?? []),
        ...(inputMode === 'csv' ? csvNotices : []),
        ...processErrors,
        ...(dataset?.issues.map((issue) => issue.message) ?? []),
    ]));
    const shownDataset =
        dataset ?? (showSimulated ? simulatedDataset() : null);

    const summary = useMemo(
        () =>
            shownDataset
                ? summarizeSeries({
                      observations: shownDataset.observations,
                      issues: shownDataset.issues,
                      baselineLuminance: shownDataset.baseline,
                  })
                : null,
        [shownDataset],
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={
                    <>
                        Kinetic Analysis
                        <span className="badge-demo">RESEARCH PROTOTYPE</span>
                    </>
                }
                subtitle="Image-derived optical measurements across a time series — descriptive kinetics only. Optical changes can arise from illumination, focus, camera processing, compression, or other factors; they are never bacterial growth, susceptibility, or clinical endpoints."
            >
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSimulated((v) => !v)}
                    aria-pressed={showSimulated}
                >
                    {showSimulated ? 'Hide simulated preview' : 'Preview simulated layout'}
                </Button>
            </PageHeader>

            {dataset?.savedRecord ? (
                <p role="status" className="rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.04)] px-4 py-3 text-[12.5px] text-txt-2">
                    Loaded persisted kinetic results. Source image/CSV files are not stored, and any file names in the observations are metadata only.
                </p>
            ) : null}

            <WorkflowStepper
                steps={STEPS.map((s, i) => ({
                    id: s.id,
                    index: i,
                    title: s.title,
                    description: s.description,
                    status: STEP_STATUS(i, step) as 'complete' | 'active' | 'upcoming',
                    detail: '',
                }))}
                selectedId={STEPS[step]?.id ?? STEPS[0].id}
                onSelect={(id) => {
                    const idx = STEPS.findIndex((s) => s.id === id);
                    if (idx >= 0) setStep(idx);
                }}
            />

            {/* Step 1–2: dataset */}
            <GlassCard title="1 · Time-series dataset">
                <p className="mb-4 text-[13px] leading-relaxed text-txt-muted">
                    Image sequence (path A) or measurement CSV (path B).
                </p>
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Input method">
                    {(['images', 'csv'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => { setInputMode(mode); setStep(0); }}
                            aria-pressed={inputMode === mode}
                            className={`mono rounded-full border px-4 py-1.5 text-[12px] ${inputMode === mode ? 'border-cyan bg-[rgba(0,242,254,0.1)] text-cyan' : 'border-line text-txt-muted'}`}
                        >
                            {mode === 'images' ? 'A · Image sequence' : 'B · Measurement CSV'}
                        </button>
                    ))}
                </div>

                {inputMode === 'images' ? (
                    <SequenceUploader
                        onFilesSelected={handleFiles}
                        busy={processing}
                        error={seq.sequenceError}
                    />
                ) : (
                    <CsvImporter onTextLoaded={handleCsvText} error={csvError} />
                )}
            </GlassCard>

            {inputMode === 'images' && frames.length > 0 ? (
                <GlassCard title="2 · Elapsed times &amp; frames">
                    <p className="mb-4 text-[13px] leading-relaxed text-txt-muted">
                        Sort order follows elapsed time. Duplicate or invalid times must be resolved before processing.
                    </p>
                    <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                        {[...frames]
                            .sort((a, b) => a.timeMin - b.timeMin)
                            .map((frame) => (
                                <li
                                    key={frame.id}
                                    className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-[rgba(255,255,255,0.03)] px-3 py-2"
                                >
                                    <img
                                        src={frame.objectUrl}
                                        alt=""
                                        aria-hidden="true"
                                        className="h-10 w-10 shrink-0 rounded border border-line object-cover"
                                    />
                                    <div className="min-w-0 flex-1 basis-40">
                                        <p className="truncate text-[13px] font-medium text-txt">
                                            {frame.fileName}
                                        </p>
                                        <p className="mono text-[11px] text-txt-muted">
                                            {formatBytes(frame.fileSize)}
                                            {frame.status === 'ready'
                                                ? ` · ${frame.width}x${frame.height}px`
                                                : ` · ${frame.status.toUpperCase()}`}
                                            {frame.id === referenceFrame?.id ? ' · REFERENCE' : ''}
                                        </p>
                                    </div>
                                    <label className="flex items-center gap-1.5">
                                        <span className="mono text-[10.5px] uppercase text-txt-muted">
                                            t (min)
                                        </span>
                                        <input
                                            type="number"
                                            className="field-input w-24 py-1.5 text-[13px]"
                                            value={Number.isFinite(frame.timeMin) ? frame.timeMin : 0}
                                            min={0}
                                            step="any"
                                            disabled={processing}
                                            aria-label={`Elapsed time in minutes for ${frame.fileName}`}
                                            onChange={(event) => {
                                                const value = Number(event.target.value);
                                                if (Number.isFinite(value) && value >= 0) {
                                                    seq.setFrameTime(frame.id, value);
                                                    setDataset(null);
                                                }
                                            }}
                                        />
                                    </label>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={processing}
                                        onClick={() => setReferenceId(frame.id)}
                                    >
                                        {frame.id === referenceFrame?.id ? 'Reference ✓' : 'Set reference'}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={processing}
                                        onClick={() => { seq.removeFrame(frame.id); setDataset(null); }}
                                        aria-label={`Remove ${frame.fileName}`}
                                    >
                                        ✕
                                    </Button>
                                </li>
                            ))}
                    </ul>
                    {duplicateTimes.length > 0 ? (
                        <p role="alert" className="rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-2.5 text-[12.5px] leading-relaxed text-[#fde68a]">
                            Duplicate elapsed time(s): {duplicateTimes.map((t) => `${t} min`).join(', ')}. Both rows are kept in time order, but per-minute rates adjacent to a duplicate are unavailable.
                        </p>
                    ) : null}
                    {invalidTimes.length > 0 ? (
                        <p role="alert" className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-2.5 text-[12.5px] leading-relaxed text-[#fecaca]">
                            {invalidTimes.length} frame(s) have invalid elapsed times. Times must be finite numbers ≥ 0 minutes.
                        </p>
                    ) : null}
                    {mismatches.length > 0 ? (
                        <div className="rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.06)] px-4 py-3">
                            <p className="text-[13px] font-semibold text-[#fde68a]">
                                Dimension mismatch — explicit approval required
                            </p>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-txt-2">
                                The shared ROI uses reference-frame coordinates ({referenceFrame!.width}×{referenceFrame!.height}px). The frames below differ in size; approve each one to measure it with the same coordinates, or remove it. Nothing is ever silently realigned.
                            </p>
                            <ul className="mt-2 flex flex-col gap-1.5">
                                {mismatches.map(({ frame, approved }) => (
                                    <li key={frame.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                                        <span className="mono text-txt">{frame.fileName} ({frame.width}×{frame.height}px)</span>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            disabled={processing}
                                            onClick={() =>
                                                setApprovedMismatchIds((ids) =>
                                                    approved ? ids.filter((id) => id !== frame.id) : [...ids, frame.id],
                                                )
                                            }
                                            aria-pressed={approved}
                                        >
                                            {approved ? 'Approved ✓ (revoke)' : 'Approve same-ROI measurement'}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2.5">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={processing}
                            onClick={() => { seq.clearSequence(); setDataset(null); setRoi(null); setApprovedMismatchIds([]); setStep(0); }}
                        >
                            Clear sequence
                        </Button>
                    </div>
                </GlassCard>
            ) : null}

            {inputMode === 'images' && referenceFrame ? (
                <GlassCard title="3 · Shared ROI on reference frame">
                    <p className="mb-4 text-[13px] leading-relaxed text-txt-muted">
                        Same original-pixel coordinates applied to every frame of matching size.
                        Reference: {referenceFrame.fileName} ({referenceFrame.width}×{referenceFrame.height}px).
                    </p>
                    <ImageCanvas
                        objectUrl={referenceFrame.objectUrl}
                        imageRef={hiddenImageRef}
                        naturalWidth={referenceFrame.width}
                        naturalHeight={referenceFrame.height}
                        roi={roi}
                        onRoiChange={setRoi}
                        onClearRoi={() => setRoi(null)}
                        onResetRoi={() =>
                            setRoi({
                                x: 0,
                                y: 0,
                                width: referenceFrame.width,
                                height: referenceFrame.height,
                            })
                        }
                    />
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                            onClick={handleProcess}
                            disabled={!canProcess}
                        >
                            {processing ? 'Processing…' : 'Process sequence'}
                        </Button>
                        {roi ? (
                            <span className="mono text-[11px] text-txt-muted">
                                ROI: {roi.x},{roi.y} · {roi.width}×{roi.height}px
                            </span>
                        ) : (
                            <span className="text-[12.5px] text-txt-muted">
                                Draw a rectangle on the image to set the ROI.
                            </span>
                        )}
                    </div>
                    {processErrors.length > 0 ? (
                        <p role="alert" className="mt-3 rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-2.5 text-[12.5px] leading-relaxed text-[#fecaca]">
                            {processErrors.join(' ')}
                        </p>
                    ) : null}
                </GlassCard>
            ) : null}

            {shownDataset && shownDataset.observations.length > 0 ? (
                <>
                    {visibleNotices.length > 0 && (
                        <GlassCard title="Validation notices">
                            <ul className="flex flex-col gap-1.5">
                                {visibleNotices.map((n, i) => (
                                    <li key={i} className="text-[13px] text-[#fde68a]">{n}</li>
                                ))}
                            </ul>
                        </GlassCard>
                    )}
                    <GlassCard
                        glow
                        title={`Results — ${shownDataset.origin === 'simulated' ? 'Simulated preview' : shownDataset.savedRecord ? 'Saved image-derived data' : 'Image-derived data'}`}
                    >
                        <p className="mb-4 text-[13px] text-txt-muted">
                            {summary
                                ? `${summary.count} observation(s) · time span: ${summary.timeSpanMin?.toFixed(1) ?? 'n/a'} min · baseline Y: ${summary.baselineLuminance?.toFixed(2) ?? 'n/a'}`
                                : ''}
                        </p>
                        <KineticSeriesChart observations={shownDataset.observations} />
                        <div className="mt-6">
                            <KineticTable observations={shownDataset.observations} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2.5">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleExport}
                                disabled={shownDataset.origin === 'simulated'}
                            >
                                {exported ? 'Exported ✓' : 'Export CSV'}
                            </Button>
                        </div>
                    </GlassCard>
                </>
            ) : null}

            {/* Step 5 — dedicated Export panel */}
            <GlassCard title="5 · Export — CSV results">
                <p className="mb-5 text-[13px] leading-relaxed text-txt-muted">
                    Downloads a CSV file containing elapsed time, source filename, mean R / G / B,
                    luminance, baseline change, rate per minute, normalised change, and calibration
                    flags for every validated observation. Simulated preview data cannot be exported.
                </p>
                {dataset && dataset.observations.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        <div className="mono rounded-lg border border-line bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[12px] leading-relaxed text-txt-2">
                            <span className="font-semibold text-cyan">Dataset ready</span>
                            {'  ·  '}
                            {dataset.observations.length} observation(s)
                            {'  ·  '}
                            origin: {dataset.origin}
                            {dataset.observations.some((o) => o.calibrated) ? '  ·  calibrated' : '  ·  raw'}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={handleExport}>
                                {exported ? '✓ Exported — download again' : '⬇ Download CSV'}
                            </Button>
                            {exported && (
                                <span className="text-[13px] text-pass">
                                    File saved — check your downloads folder.
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-line bg-[rgba(255,255,255,0.02)] px-5 py-6 text-center">
                        <p className="text-[13.5px] font-medium text-txt-2">No processed data available</p>
                        <p className="mt-1.5 text-[12.5px] text-txt-muted">
                            Complete Steps 1–3 (load images, assign times, select an ROI, and press
                            &ldquo;Process sequence&rdquo;) or import a measurement CSV to enable export.
                        </p>
                    </div>
                )}
            </GlassCard>
            <AnalysisPersistencePanel
                kind="kinetic-analyses"
                title="Save or load kinetic analysis"
                canSave={Boolean(dataset && dataset.origin !== 'simulated' && dataset.observations.length > 0 && dataset.baseline !== null)}
                disabledReason="Process an image sequence or import a measurement CSV first. Simulated preview data cannot be saved."
                onSave={handleSaveKineticAnalysis}
                onLoad={handleLoadKineticAnalysis}
            />
        </div>
    );
}
