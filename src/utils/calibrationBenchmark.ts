import {
    applyCalibration,
    fitCalibration,
    type CalibrationModel,
    type Rgb,
} from './calibration.ts';
import type { RoiRect } from '../types';

export const BENCHMARK_METHOD_VERSION = 'colorchecker-heldout-image-rgb-rmse-v1';
export const BENCHMARK_METHOD_DESCRIPTION =
    'Per-channel affine least-squares fit on fit-role images; error is pooled RGB-channel RMSE against supplied 8-bit sRGB reference values, in sRGB code values (0–255).';
export const BENCHMARK_LIMITATIONS = [
    'Patch ROIs and patch identities are supplied by the dataset manifest and are not automatically detected or independently verified.',
    'Reference provenance and conversion to 8-bit sRGB are supplied by the user and are not independently authenticated.',
    'Held-out validation is split by image, but does not establish performance across laboratories, devices, lighting conditions, or clinical outcomes.',
    'RGB code-value RMSE is not a perceptual colour-difference metric such as CIE ΔE.',
];

export type BenchmarkRole = 'fit' | 'validation';

export interface BenchmarkPatch {
    patchId: string;
    roi: RoiRect;
    referenceRgb: Rgb;
}

export interface BenchmarkImage {
    imageId: string;
    file: string;
    role: BenchmarkRole;
    captureSettings: Record<string, string>;
    patches: BenchmarkPatch[];
}

export interface CalibrationBenchmarkManifest {
    datasetId: string;
    reference: {
        standard: string;
        source: string;
        colorSpace: 'sRGB';
        encoding: '8-bit';
        illuminant: string;
        observer: string;
    };
    patchMeasurement: {
        method: string;
        notes: string;
    };
    calibrationSettings: Record<string, string>;
    limitations: string[];
    images: BenchmarkImage[];
}

export interface BenchmarkMeasurement {
    imageId: string;
    patchId: string;
    measuredRgb: Rgb;
    sampleCount: number;
}

export interface BenchmarkImageResult {
    datasetId: string;
    imageId: string;
    file: string;
    role: BenchmarkRole;
    patchCount: number;
    rawRgbRmse: number;
    calibratedRgbRmse: number;
    improvementRgbCodeValues: number;
    calibrationSettings: string;
    captureSettings: string;
}

export interface CalibrationBenchmarkReport {
    datasetId: string;
    referenceStandard: string;
    referenceSource: string;
    referenceIlluminant: string;
    referenceObserver: string;
    patchMeasurementMethod: string;
    patchMeasurementNotes: string;
    methodVersion: string;
    method: string;
    fitImageIds: string[];
    validationImageIds: string[];
    fitPatchCount: number;
    validationPatchCount: number;
    fitRawRgbRmse: number;
    fitCalibratedRgbRmse: number;
    validationRawRgbRmse: number;
    validationCalibratedRgbRmse: number;
    model: CalibrationModel;
    rows: BenchmarkImageResult[];
    limitations: string[];
}

export type ManifestParseResult =
    | { ok: true; manifest: CalibrationBenchmarkManifest }
    | { ok: false; errors: string[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
const inRgbRange = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 255;
const safeRelativeFile = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && !value.includes('\\') &&
    !value.startsWith('/') && !/^[A-Za-z]:/.test(value) &&
    value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');

function stringSettings(value: unknown): value is Record<string, string> {
    return isObject(value) && Object.keys(value).length > 0 &&
        Object.entries(value).every(([key, setting]) => nonEmpty(key) && nonEmpty(setting));
}

function parseRgb(value: unknown): value is Rgb {
    return isObject(value) && inRgbRange(value.r) && inRgbRange(value.g) && inRgbRange(value.b);
}

function parseRoi(value: unknown): value is RoiRect {
    return isObject(value) &&
        typeof value.x === 'number' && Number.isSafeInteger(value.x) && value.x >= 0 &&
        typeof value.y === 'number' && Number.isSafeInteger(value.y) && value.y >= 0 &&
        typeof value.width === 'number' && Number.isSafeInteger(value.width) && value.width > 0 &&
        typeof value.height === 'number' && Number.isSafeInteger(value.height) && value.height > 0;
}

/** Validate caller-supplied references, independent image splits, and ROI annotations. */
export function parseCalibrationBenchmarkManifest(value: unknown): ManifestParseResult {
    const errors: string[] = [];
    if (!isObject(value)) return { ok: false, errors: ['Manifest must be a JSON object.'] };

    if (!nonEmpty(value.datasetId)) errors.push('datasetId must be a non-empty identifier.');
    if (!isObject(value.reference)) {
        errors.push('reference metadata is required; no ground-truth colours are bundled with UniAST.');
    } else {
        for (const field of ['standard', 'source', 'illuminant', 'observer'] as const) {
            if (!nonEmpty(value.reference[field])) errors.push(`reference.${field} must be provided.`);
        }
        if (value.reference.colorSpace !== 'sRGB') errors.push('reference.colorSpace must be sRGB.');
        if (value.reference.encoding !== '8-bit') errors.push('reference.encoding must be 8-bit.');
    }

    if (!isObject(value.patchMeasurement) || !nonEmpty(value.patchMeasurement.method) || !nonEmpty(value.patchMeasurement.notes)) {
        errors.push('patchMeasurement.method and patchMeasurement.notes are required to describe ROI measurement.');
    }
    if (!stringSettings(value.calibrationSettings)) {
        errors.push('calibrationSettings must contain at least one non-empty setting.');
    }
    if (!Array.isArray(value.limitations) || value.limitations.some((item) => !nonEmpty(item))) {
        errors.push('limitations must be an array of non-empty strings (use [] when there are no additional notes).');
    }
    if (!Array.isArray(value.images) || value.images.length < 2) {
        errors.push('images must include at least one fit image and one independent validation image.');
        return { ok: false, errors };
    }

    const imageIds = new Set<string>();
    const files = new Set<string>();
    const referenceByPatch = new Map<string, Rgb>();
    let expectedPatchIds: Set<string> | null = null;
    let fitCount = 0;
    let validationCount = 0;

    for (const [imageIndex, rawImage] of value.images.entries()) {
        const label = `images[${imageIndex}]`;
        if (!isObject(rawImage)) {
            errors.push(`${label} must be an object.`);
            continue;
        }
        const { imageId, file, role, captureSettings, patches } = rawImage;
        if (!nonEmpty(imageId) || imageIds.has(imageId)) errors.push(`${label}.imageId must be non-empty and unique.`);
        else imageIds.add(imageId);
        if (!safeRelativeFile(file)) errors.push(`${label}.file must be a safe relative file path inside the selected dataset folder.`);
        else if (files.has(file)) errors.push(`${label}.file is duplicated.`);
        else files.add(file);
        if (role !== 'fit' && role !== 'validation') errors.push(`${label}.role must be fit or validation.`);
        else if (role === 'fit') fitCount += 1;
        else validationCount += 1;
        if (!stringSettings(captureSettings)) errors.push(`${label}.captureSettings must describe at least one capture setting.`);
        if (!Array.isArray(patches) || patches.length === 0) {
            errors.push(`${label}.patches must contain measured chart-patch ROIs and reference RGB values.`);
            continue;
        }

        const patchIds = new Set<string>();
        for (const [patchIndex, rawPatch] of patches.entries()) {
            const patchLabel = `${label}.patches[${patchIndex}]`;
            if (!isObject(rawPatch)) {
                errors.push(`${patchLabel} must be an object.`);
                continue;
            }
            const { patchId, roi, referenceRgb } = rawPatch;
            if (!nonEmpty(patchId) || patchIds.has(patchId)) errors.push(`${patchLabel}.patchId must be non-empty and unique within its image.`);
            else patchIds.add(patchId);
            if (!parseRoi(roi)) errors.push(`${patchLabel}.roi must be a positive integer rectangle in original image pixels.`);
            if (!parseRgb(referenceRgb)) errors.push(`${patchLabel}.referenceRgb must provide finite R, G and B values from 0 to 255.`);
            if (nonEmpty(patchId) && parseRgb(referenceRgb)) {
                const existing = referenceByPatch.get(patchId);
                if (existing && (existing.r !== referenceRgb.r || existing.g !== referenceRgb.g || existing.b !== referenceRgb.b)) {
                    errors.push(`Patch ${patchId} has inconsistent reference RGB values across images.`);
                } else referenceByPatch.set(patchId, referenceRgb);
            }
        }
        if (expectedPatchIds === null) expectedPatchIds = patchIds;
        else if (patchIds.size !== expectedPatchIds.size || [...expectedPatchIds].some((id) => !patchIds.has(id))) {
            errors.push(`${label} must contain the same patch IDs as every other image.`);
        }
    }
    if (fitCount === 0) errors.push('At least one image must have role fit.');
    if (validationCount === 0) errors.push('At least one independent image must have role validation.');
    if (errors.length > 0) return { ok: false, errors };

    return {
        ok: true,
        manifest: value as unknown as CalibrationBenchmarkManifest,
    };
}

const stableJson = (value: Record<string, string>): string =>
    JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));

function rgbRmse(samples: ReadonlyArray<{ measured: Rgb; reference: Rgb }>): number {
    let squaredError = 0;
    for (const sample of samples) {
        squaredError += (sample.measured.r - sample.reference.r) ** 2;
        squaredError += (sample.measured.g - sample.reference.g) ** 2;
        squaredError += (sample.measured.b - sample.reference.b) ** 2;
    }
    return Math.sqrt(squaredError / (samples.length * 3));
}

/** Fit on fit-role images only, then score each image with pooled RGB-code-value RMSE. */
export function calculateCalibrationBenchmark(
    manifest: CalibrationBenchmarkManifest,
    measurements: ReadonlyArray<BenchmarkMeasurement>,
): CalibrationBenchmarkReport {
    const expected = new Map<string, { image: BenchmarkImage; patch: BenchmarkPatch }>();
    for (const image of manifest.images) {
        for (const patch of image.patches) expected.set(`${image.imageId}\0${patch.patchId}`, { image, patch });
    }
    const seen = new Set<string>();
    const samplesByImage = new Map<string, Array<{ measured: Rgb; reference: Rgb }>>();
    for (const measurement of measurements) {
        const key = `${measurement.imageId}\0${measurement.patchId}`;
        const annotation = expected.get(key);
        if (!annotation) throw new Error(`Unexpected measurement ${measurement.imageId}/${measurement.patchId}.`);
        if (seen.has(key)) throw new Error(`Duplicate measurement ${measurement.imageId}/${measurement.patchId}.`);
        if (!parseRgb(measurement.measuredRgb) || !Number.isSafeInteger(measurement.sampleCount) || measurement.sampleCount <= 0) {
            throw new Error(`Measurement ${measurement.imageId}/${measurement.patchId} is invalid.`);
        }
        seen.add(key);
        const imageSamples = samplesByImage.get(measurement.imageId) ?? [];
        imageSamples.push({ measured: measurement.measuredRgb, reference: annotation.patch.referenceRgb });
        samplesByImage.set(measurement.imageId, imageSamples);
    }
    const missing = [...expected.keys()].filter((key) => !seen.has(key));
    if (missing.length) throw new Error(`Missing ${missing.length} patch measurement(s); no benchmark result was calculated.`);

    const fitSamples = manifest.images
        .filter((image) => image.role === 'fit')
        .flatMap((image) => samplesByImage.get(image.imageId) ?? []);
    const model = fitCalibration(fitSamples);
    if (!model.available) {
        const channels = (['r', 'g', 'b'] as const).filter((channel) => model[channel].status !== 'ok').map((channel) => channel.toUpperCase());
        throw new Error(`Calibration fit is not identifiable for channel(s) ${channels.join(', ')}. Check that fit images include distinct measured values for every channel.`);
    }

    const rows = manifest.images.map((image): BenchmarkImageResult => {
        const imageSamples = samplesByImage.get(image.imageId) ?? [];
        const calibrated = imageSamples.map((sample) => {
            const result = applyCalibration(model, sample.measured);
            if (!result) throw new Error('Calibration model could not be applied.');
            return { measured: result.corrected, reference: sample.reference };
        });
        const rawRgbRmse = rgbRmse(imageSamples);
        const calibratedRgbRmse = rgbRmse(calibrated);
        return {
            datasetId: manifest.datasetId,
            imageId: image.imageId,
            file: image.file,
            role: image.role,
            patchCount: imageSamples.length,
            rawRgbRmse,
            calibratedRgbRmse,
            improvementRgbCodeValues: rawRgbRmse - calibratedRgbRmse,
            calibrationSettings: stableJson(manifest.calibrationSettings),
            captureSettings: stableJson(image.captureSettings),
        };
    });
    const pool = (role: BenchmarkRole, corrected: boolean) => {
        const samples = manifest.images.filter((image) => image.role === role)
            .flatMap((image) => samplesByImage.get(image.imageId) ?? [])
            .map((sample) => {
                if (!corrected) return sample;
                const result = applyCalibration(model, sample.measured);
                if (!result) throw new Error('Calibration model could not be applied.');
                return { measured: result.corrected, reference: sample.reference };
            });
        return rgbRmse(samples);
    };
    const validationImages = manifest.images.filter((image) => image.role === 'validation');
    return {
        datasetId: manifest.datasetId,
        referenceStandard: manifest.reference.standard,
        referenceSource: manifest.reference.source,
        referenceIlluminant: manifest.reference.illuminant,
        referenceObserver: manifest.reference.observer,
        patchMeasurementMethod: manifest.patchMeasurement.method,
        patchMeasurementNotes: manifest.patchMeasurement.notes,
        methodVersion: BENCHMARK_METHOD_VERSION,
        method: BENCHMARK_METHOD_DESCRIPTION,
        fitImageIds: manifest.images.filter((image) => image.role === 'fit').map((image) => image.imageId),
        validationImageIds: validationImages.map((image) => image.imageId),
        fitPatchCount: fitSamples.length,
        validationPatchCount: validationImages.reduce((count, image) => count + (samplesByImage.get(image.imageId)?.length ?? 0), 0),
        fitRawRgbRmse: pool('fit', false),
        fitCalibratedRgbRmse: pool('fit', true),
        validationRawRgbRmse: pool('validation', false),
        validationCalibratedRgbRmse: pool('validation', true),
        model,
        rows,
        limitations: [...BENCHMARK_LIMITATIONS, ...manifest.limitations],
    };
}

function csvCell(value: string | number): string {
    const text = typeof value === 'number' ? value.toFixed(6) : value;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Export deterministic per-image rows with method, split and limitations metadata. */
export function exportCalibrationBenchmarkCsv(report: CalibrationBenchmarkReport): string {
    const columns = [
        'dataset_id', 'image_id', 'image_file', 'split', 'patch_count',
        'raw_rgb_rmse_srgb_code_values', 'calibrated_rgb_rmse_srgb_code_values',
        'improvement_srgb_code_values', 'calibration_settings_json', 'capture_settings_json',
        'calibration_model_json',
        'reference_standard', 'reference_source', 'reference_illuminant', 'reference_observer',
        'patch_measurement_method', 'patch_measurement_notes', 'method_version', 'method', 'limitations',
    ];
    const rows = report.rows.map((row) => [
        row.datasetId, row.imageId, row.file, row.role, String(row.patchCount),
        row.rawRgbRmse.toFixed(6), row.calibratedRgbRmse.toFixed(6), row.improvementRgbCodeValues.toFixed(6),
        row.calibrationSettings, row.captureSettings, JSON.stringify(report.model),
        report.referenceStandard, report.referenceSource, report.referenceIlluminant,
        report.referenceObserver, report.patchMeasurementMethod, report.patchMeasurementNotes,
        report.methodVersion, report.method, report.limitations.join('; '),
    ].map(csvCell).join(','));
    return [columns.join(','), ...rows].join('\r\n');
}
