import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { computeRoiStatistics } from '../utils/roiStatistics';
import {
    BENCHMARK_METHOD_DESCRIPTION,
    calculateCalibrationBenchmark,
    exportCalibrationBenchmarkCsv,
    parseCalibrationBenchmarkManifest,
    type CalibrationBenchmarkReport,
    type BenchmarkMeasurement,
} from '../utils/calibrationBenchmark';

type RelativeFile = File & { webkitRelativePath?: string };

function relativeToFolder(file: File): string | null {
    const path = (file as RelativeFile).webkitRelativePath;
    if (!path) return null;
    const segments = path.replaceAll('\\', '/').split('/');
    return segments.length > 1 ? segments.slice(1).join('/') : null;
}

function decodeLocalImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Image “${file.name}” could not be decoded.`));
        };
        image.src = url;
    });
}

function format(value: number): string {
    return value.toFixed(3);
}

export function CalibrationBenchmarkPage() {
    const directoryInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<CalibrationBenchmarkReport | null>(null);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [imageFileCount, setImageFileCount] = useState(0);

    useEffect(() => {
        directoryInput.current?.setAttribute('webkitdirectory', '');
        directoryInput.current?.setAttribute('directory', '');
    }, []);

    const handleDirectory = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const files = Array.from(input.files ?? []);
        setReport(null);
        setError(null);
        setSelectedFolder('');
        setImageFileCount(0);
        if (files.length === 0) return;
        setBusy(true);
        try {
            const fileEntries = files.map((file) => ({ file, relative: relativeToFolder(file) }));
            if (fileEntries.some((entry) => entry.relative === null)) {
                throw new Error('Select a dataset folder in a browser that supports folder selection.');
            }
            const firstPath = (files[0] as RelativeFile).webkitRelativePath ?? '';
            setSelectedFolder(firstPath.split('/')[0] || 'Selected dataset');
            const manifestFiles = fileEntries.filter((entry) => entry.relative === 'manifest.json');
            if (manifestFiles.length !== 1) {
                const imageCount = fileEntries.filter((entry) => entry.relative !== null && /\.(png|jpe?g|webp)$/i.test(entry.relative)).length;
                if (manifestFiles.length === 0 && imageCount > 0) {
                    throw new Error(`Found ${imageCount} image file(s), but no root-level manifest.json. UniAST does not automatically detect ColorChecker patches or provide reference RGB values. Add a manifest with cited references and manually verified interior patch ROIs before benchmarking.`);
                }
                throw new Error('The selected folder must contain exactly one root-level manifest.json.');
            }
            const raw: unknown = JSON.parse(await manifestFiles[0].file.text());
            const validation = parseCalibrationBenchmarkManifest(raw);
            if (!validation.ok) throw new Error(validation.errors.join(' '));
            const manifest = validation.manifest;

            const filesByRelativePath = new Map<string, File>();
            for (const entry of fileEntries) {
                if (entry.relative !== null) filesByRelativePath.set(entry.relative, entry.file);
            }
            const imageEntries = manifest.images.map((image) => {
                const file = filesByRelativePath.get(image.file);
                if (!file) throw new Error(`Image file “${image.file}” from image ${image.imageId} was not found in the selected folder.`);
                if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
                    throw new Error(`Image “${file.name}” must be PNG, JPEG or WebP.`);
                }
                return { image, file };
            });

            const measurements: BenchmarkMeasurement[] = [];
            for (const { image, file } of imageEntries) {
                const decoded = await decodeLocalImage(file);
                for (const patch of image.patches) {
                    if (patch.roi.x + patch.roi.width > decoded.naturalWidth ||
                        patch.roi.y + patch.roi.height > decoded.naturalHeight) {
                        throw new Error(`ROI for ${image.imageId}/${patch.patchId} extends beyond the ${decoded.naturalWidth}×${decoded.naturalHeight} image.`);
                    }
                    const stats = computeRoiStatistics(decoded, patch.roi);
                    if (!stats) throw new Error(`ROI for ${image.imageId}/${patch.patchId} could not be measured.`);
                    if (stats.resampled) throw new Error(`ROI for ${image.imageId}/${patch.patchId} exceeds the exact-sampling limit. Use a smaller patch interior ROI.`);
                    measurements.push({
                        imageId: image.imageId,
                        patchId: patch.patchId,
                        measuredRgb: { r: stats.meanR, g: stats.meanG, b: stats.meanB },
                        sampleCount: stats.samples,
                    });
                }
            }
            setImageFileCount(imageEntries.length);
            setReport(calculateCalibrationBenchmark(manifest, measurements));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not process this benchmark dataset.');
        } finally {
            setBusy(false);
            // Let the same directory be selected again to retry after corrections.
            input.value = '';
        }
    };

    const exportCsv = () => {
        if (!report) return;
        const blob = new Blob([exportCalibrationBenchmarkCsv(report)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `uniast-calibration-benchmark-${report.datasetId.replace(/[^a-z0-9_-]/gi, '_')}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <PageHeader
                title={<>Calibration benchmark <Badge tone="cyan">LOCAL DATA</Badge></>}
                subtitle="Evaluate a user-supplied ColorChecker image folder against explicitly sourced 8-bit sRGB references. All image processing stays in this browser."
            />

            <div className="mb-5 rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-[13px] leading-relaxed text-[#fde68a]">
                UniAST includes no ColorChecker images or reference values. This benchmark reports no errors until the selected dataset provides reference provenance and annotated patch ROIs. Results are optical colour measurements only, not antimicrobial susceptibility accuracy or clinical validation.
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <GlassCard glow title="Dataset folder and manifest">
                    <p className="mb-4 text-[13px] leading-relaxed text-txt-muted">
                        Choose a local folder containing a root-level <code className="mono text-cyan">manifest.json</code> and its referenced PNG, JPEG or WebP images. The manifest supplies chart reference values, source details, integer pixel ROIs, image-level fit/validation roles, capture settings and limitations. No files are uploaded.
                    </p>
                    <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt-2">
                        ColorChecker dataset folder
                        <input
                            ref={directoryInput}
                            type="file"
                            multiple
                            accept=".json,.png,.jpg,.jpeg,.webp"
                            onChange={(event) => void handleDirectory(event)}
                            className="field-input text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-[rgba(0,242,254,0.12)] file:px-3 file:py-2 file:text-cyan"
                            aria-label="Select local ColorChecker dataset folder"
                        />
                    </label>
                    {selectedFolder ? <p className="mt-3 mono text-[11px] text-txt-muted">Folder: {selectedFolder} · {imageFileCount || 'processing'} image(s)</p> : null}
                    {busy ? <p role="status" className="mt-3 text-[13px] text-cyan">Decoding images and measuring annotated patches…</p> : null}
                    {error ? <p role="alert" className="mt-4 rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-3 py-2.5 text-[12.5px] text-[#fecaca]">{error}</p> : null}
                    <div className="mt-5 rounded-lg border border-line bg-black/20 p-3 text-[12px] leading-relaxed text-txt-muted">
                        Required manifest facts: dataset ID; reference standard, source, sRGB encoding, illuminant and observer; patch-measurement method and notes; capture/calibration settings; additional limitations; and per-image IDs, relative paths, roles and patch IDs/ROIs/reference RGB. Every image must have the same patch IDs and reference RGB values. Validation images are held out from fitting.
                    </div>
                    <p className="mt-3 text-[11.5px] leading-relaxed text-txt-muted">
                        ROI measurements use the existing browser canvas and Rec.709 channel statistics; benchmark ROIs that require downsampling are rejected to preserve exact per-pixel sampling. Patch identity and whether each ROI is a clean chart interior remain user-supplied and are not automatically verified.
                    </p>
                </GlassCard>

                <GlassCard glow title="Benchmark method">
                    <p className="text-[13px] leading-relaxed text-txt-2">{BENCHMARK_METHOD_DESCRIPTION}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-line bg-[rgba(255,255,255,0.025)] p-3">
                            <h3 className="mono text-[11px] font-semibold uppercase text-cyan">Fit images</h3>
                            <p className="mt-1 text-[12px] leading-relaxed text-txt-muted">Train the existing per-channel affine least-squares model. Reported fit error describes the training images only.</p>
                        </div>
                        <div className="rounded-lg border border-line bg-[rgba(255,255,255,0.025)] p-3">
                            <h3 className="mono text-[11px] font-semibold uppercase text-violet-300">Held-out images</h3>
                            <p className="mt-1 text-[12px] leading-relaxed text-txt-muted">Entire images assigned validation are excluded from fitting and scored separately.</p>
                        </div>
                    </div>
                    <p className="mt-4 text-[12px] leading-relaxed text-txt-muted">Metric: pooled root mean squared error over all R, G and B channel residuals, <code className="mono">sqrt(sum((measured − reference)²) / (3 × patch count))</code>. Values are 8-bit sRGB code-value units (0–255), not ΔE or a perceptual metric.</p>
                </GlassCard>
            </div>

            {report ? (
                <div className="mt-5 flex flex-col gap-5">
                    <GlassCard glow title={`Results · ${report.datasetId}`} action={<Button variant="primary" onClick={exportCsv}>Export CSV</Button>}>
                        <div className="mb-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.04)] p-4">
                                <p className="mono text-[11px] uppercase tracking-wide text-cyan">Fit images · training result</p>
                                <p className="mt-2 text-[13px] text-txt-2">Raw RGB RMSE <strong className="mono text-white">{format(report.fitRawRgbRmse)}</strong> → calibrated <strong className="mono text-white">{format(report.fitCalibratedRgbRmse)}</strong></p>
                                <p className="mt-1 mono text-[10.5px] text-txt-muted">{report.fitPatchCount} patch measurements · {report.fitImageIds.join(', ')}</p>
                            </div>
                            <div className="rounded-lg border border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.05)] p-4">
                                <p className="mono text-[11px] uppercase tracking-wide text-violet-300">Held-out images · independent split</p>
                                <p className="mt-2 text-[13px] text-txt-2">Raw RGB RMSE <strong className="mono text-white">{format(report.validationRawRgbRmse)}</strong> → calibrated <strong className="mono text-white">{format(report.validationCalibratedRgbRmse)}</strong></p>
                                <p className="mt-1 mono text-[10.5px] text-txt-muted">{report.validationPatchCount} patch measurements · {report.validationImageIds.join(', ')}</p>
                            </div>
                        </div>
                        <p className="mb-3 text-[11.5px] text-txt-muted">Reference: {report.referenceStandard} · {report.referenceSource} · {report.referenceIlluminant}, {report.referenceObserver}. Patch ROIs: {report.patchMeasurementMethod} — {report.patchMeasurementNotes}</p>
                        <div className="overflow-x-auto rounded-lg border border-line">
                            <table className="w-full min-w-[900px] text-left text-[12px]">
                                <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-txt-muted">
                                    <tr>{['Image', 'Split', 'Patches', 'Raw RGB RMSE', 'Calibrated RGB RMSE', 'Improvement', 'Calibration settings'].map((heading) => <th key={heading} className="px-3 py-2.5">{heading}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {report.rows.map((row) => (
                                        <tr key={row.imageId} className="border-t border-line">
                                            <td className="px-3 py-2.5"><span className="block text-white">{row.imageId}</span><span className="mono text-[10px] text-txt-muted">{row.file}</span></td>
                                            <td className="px-3 py-2.5"><Badge tone={row.role === 'fit' ? 'cyan' : 'pending'}>{row.role === 'fit' ? 'FIT' : 'HELD OUT'}</Badge></td>
                                            <td className="px-3 py-2.5 mono text-txt-2">{row.patchCount}</td>
                                            <td className="px-3 py-2.5 mono text-txt-2">{format(row.rawRgbRmse)}</td>
                                            <td className="px-3 py-2.5 mono text-txt-2">{format(row.calibratedRgbRmse)}</td>
                                            <td className="px-3 py-2.5 mono text-txt-2">{format(row.improvementRgbCodeValues)}</td>
                                            <td className="max-w-[260px] truncate px-3 py-2.5 mono text-[10px] text-txt-muted" title={`Calibration: ${row.calibrationSettings} · Capture: ${row.captureSettings}`}>{row.calibrationSettings} · {row.captureSettings}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 mono text-[10px] text-txt-muted">RMSE / improvement units: 8-bit sRGB code values (0–255). Positive improvement means lower calibrated error.</p>
                    </GlassCard>
                    <GlassCard title="Limitations included in the export">
                        <ul className="list-disc space-y-1.5 pl-5 text-[12px] leading-relaxed text-txt-muted">
                            {report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                        </ul>
                        <details className="mt-4 rounded-lg border border-line bg-black/20 p-3">
                            <summary className="cursor-pointer text-[12px] text-txt-2">Calibration settings and model coefficients</summary>
                            <pre className="mt-3 overflow-x-auto mono text-[11px] text-txt-muted">{JSON.stringify({ settings: JSON.parse(report.rows[0]?.calibrationSettings ?? '{}'), model: report.model }, null, 2)}</pre>
                        </details>
                    </GlassCard>
                </div>
            ) : null}
        </div>
    );
}
