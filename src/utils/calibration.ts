/**
 * Reference-based optical calibration — pure, deterministic math.
 *
 * Method (documented, research-prototype grade):
 *   For each channel c ∈ {R, G, B} we fit an affine model
 *       reference_c = slope_c · measured_c + intercept_c
 *   by ordinary least squares over the user-supplied reference patches
 *   (reference patches only — held-out validation patches never enter the
 *   fit). With exactly two distinct measured values the fit is the exact
 *   two-point line; with more, it is the least-squares line. Fitting is
 *   fully deterministic.
 *
 *   Applying the model to an image-derived measurement yields
 *       corrected_c = clamp(slope_c · measured_c + intercept_c, 0, 255)
 *   and every clamped channel is reported as clipped.
 *
 *   NOTE: residual error computed on the same patches used for fitting is
 *   NOT independent validation. Independent error requires held-out
 *   validation patches measured under the same imaging conditions.
 *
 * This module is intentionally free of DOM/React imports so it can be
 * executed by the Node test runner directly.
 */

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

export type FitStatus = 'ok' | 'too-few-points' | 'degenerate';

export interface ChannelFit {
    slope: number;
    intercept: number;
}

export interface ChannelFitReport {
    status: FitStatus;
    fit: ChannelFit | null;
    /** Number of finite (measured, reference) pairs used. */
    points: number;
    /** Distinct measured values — must be ≥ 2 for a non-vertical line. */
    distinctMeasured: number;
    /** RMS of (prediction − reference) over the FIT points, in 8-bit units. */
    residualRms: number | null;
    /** Largest absolute residual over the FIT points, in 8-bit units. */
    residualMaxAbs: number | null;
    message: string;
}

export interface CalibrationModel {
    r: ChannelFitReport;
    g: ChannelFitReport;
    b: ChannelFitReport;
    /** True only when all three channels fitted successfully. */
    available: boolean;
    method: string;
    fitPatchCount: number;
}

export interface ApplyResult {
    corrected: Rgb;
    /** Channels whose unclamped value fell outside [0, 255]. */
    clippedChannels: Array<'r' | 'g' | 'b'>;
    /** True when at least one channel had to be clipped. */
    clipped: boolean;
}

export const MIN_8BIT = 0;
export const MAX_8BIT = 255;

export const CALIBRATION_METHOD =
    'Per-channel affine least squares: reference = slope · measured + intercept, applied as corrected = clamp(slope · measured + intercept, 0, 255).';
export const CALIBRATION_METHOD_VERSION = 'affine-ls-v1';

const clamp8 = (value: number) =>
    Math.min(MAX_8BIT, Math.max(MIN_8BIT, value));

/** Rec.709 luminance (Y) for 8-bit sRGB values, 0–255 scale. */
export function luminance(rgb: Rgb): number {
    return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

/**
 * Fit one channel. `points` are 8-bit (measured, reference) pairs; non-finite
 * or out-of-range pairs are ignored. Reports 'too-few-points' (< 2 usable pairs) and
 * 'degenerate' (fewer than 2 distinct measured values → vertical line).
 */
export function fitChannel(
    points: ReadonlyArray<{ measured: number; reference: number }>,
): ChannelFitReport {
    const finite = points.filter(
        (point) =>
            Number.isFinite(point.measured) && Number.isFinite(point.reference) &&
            point.measured >= MIN_8BIT && point.measured <= MAX_8BIT &&
            point.reference >= MIN_8BIT && point.reference <= MAX_8BIT,
    );

    if (finite.length < 2) {
        return {
            status: 'too-few-points',
            fit: null,
            points: finite.length,
            distinctMeasured: new Set(finite.map((p) => p.measured)).size,
            residualRms: null,
            residualMaxAbs: null,
            message: `Needs at least 2 reference patches with distinct measured values; got ${finite.length}.`,
        };
    }

    const distinct = new Set(finite.map((p) => p.measured)).size;
    if (distinct < 2) {
        return {
            status: 'degenerate',
            fit: null,
            points: finite.length,
            distinctMeasured: distinct,
            residualRms: null,
            residualMaxAbs: null,
            message: `All ${finite.length} measured values are identical — a slope cannot be determined. Add patches spanning darker and brighter tones.`,
        };
    }

    const n = finite.length;
    let sumX = 0;
    let sumY = 0;
    for (const point of finite) {
        sumX += point.measured;
        sumY += point.reference;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    // Center the sums to avoid subtracting nearly equal large values when
    // valid ROI means differ by only a small fraction of one pixel value.
    let centeredXX = 0;
    let centeredXY = 0;
    for (const point of finite) {
        const dx = point.measured - meanX;
        centeredXX += dx * dx;
        centeredXY += dx * (point.reference - meanY);
    }
    const slope = centeredXY / centeredXX;
    const intercept = meanY - slope * meanX;

    let sumSq = 0;
    let maxAbs = 0;
    for (const point of finite) {
        const residual = slope * point.measured + intercept - point.reference;
        sumSq += residual * residual;
        const abs = Math.abs(residual);
        if (abs > maxAbs) maxAbs = abs;
    }

    return {
        status: 'ok',
        fit: { slope, intercept },
        points: n,
        distinctMeasured: distinct,
        residualRms: Math.sqrt(sumSq / n),
        residualMaxAbs: maxAbs,
        message: 'Fitted.',
    };
}

export interface ReferenceSample {
    measured: Rgb;
    reference: Rgb;
}

/** Fit a full three-channel model from reference samples (fit set only). */
export function fitCalibration(
    samples: ReadonlyArray<ReferenceSample>,
): CalibrationModel {
    const r = fitChannel(
        samples.map((s) => ({ measured: s.measured.r, reference: s.reference.r })),
    );
    const g = fitChannel(
        samples.map((s) => ({ measured: s.measured.g, reference: s.reference.g })),
    );
    const b = fitChannel(
        samples.map((s) => ({ measured: s.measured.b, reference: s.reference.b })),
    );

    return {
        r,
        g,
        b,
        available: r.status === 'ok' && g.status === 'ok' && b.status === 'ok',
        method: CALIBRATION_METHOD,
        fitPatchCount: samples.length,
    };
}

/** Apply one channel's fit, clamping the result to the 8-bit range. */
export function applyChannel(
    fit: ChannelFit,
    measuredValue: number,
): { value: number; clipped: boolean } {
    const raw = fit.slope * measuredValue + fit.intercept;
    const clamped = clamp8(raw);
    return { value: clamped, clipped: clamped !== raw };
}

/**
 * Apply a fitted model to one measurement.
 * Returns null when the model is not fully available.
 */
export function applyCalibration(
    model: CalibrationModel,
    measured: Rgb,
): ApplyResult | null {
    if (!model.available || !model.r.fit || !model.g.fit || !model.b.fit) {
        return null;
    }

    const red = applyChannel(model.r.fit, measured.r);
    const green = applyChannel(model.g.fit, measured.g);
    const blue = applyChannel(model.b.fit, measured.b);

    const clippedChannels: Array<'r' | 'g' | 'b'> = [];
    if (red.clipped) clippedChannels.push('r');
    if (green.clipped) clippedChannels.push('g');
    if (blue.clipped) clippedChannels.push('b');

    return {
        corrected: { r: red.value, g: green.value, b: blue.value },
        clippedChannels,
        clipped: clippedChannels.length > 0,
    };
}

export interface ResidualSummary {
    count: number;
    /** Per-channel RMS of (corrected − reference), 8-bit units. */
    rms: Rgb;
    /** Per-channel max |corrected − reference|, 8-bit units. */
    maxAbs: Rgb;
    /** Mean |corrected luminance − reference luminance|, 8-bit units. */
    meanLuminanceError: number | null;
}

/**
 * Residual error of a sample set under the fitted model (corrected values
 * minus user-supplied references). For the fit set this is fit error, NOT
 * independent validation; for held-out patches it is genuine validation
 * error under the same imaging conditions.
 */
export function residualSummary(
    model: CalibrationModel,
    samples: ReadonlyArray<ReferenceSample>,
): ResidualSummary | null {
    if (!model.available || samples.length === 0) return null;

    const sums = { r: 0, g: 0, b: 0 };
    const maxima = { r: 0, g: 0, b: 0 };
    let lumSum = 0;

    for (const sample of samples) {
        const applied = applyCalibration(model, sample.measured);
        if (!applied) return null;
        const residuals = {
            r: applied.corrected.r - sample.reference.r,
            g: applied.corrected.g - sample.reference.g,
            b: applied.corrected.b - sample.reference.b,
        };
        sums.r += residuals.r * residuals.r;
        sums.g += residuals.g * residuals.g;
        sums.b += residuals.b * residuals.b;
        maxima.r = Math.max(maxima.r, Math.abs(residuals.r));
        maxima.g = Math.max(maxima.g, Math.abs(residuals.g));
        maxima.b = Math.max(maxima.b, Math.abs(residuals.b));
        lumSum += Math.abs(
            luminance(applied.corrected) - luminance(sample.reference),
        );
    }

    const n = samples.length;
    return {
        count: n,
        rms: {
            r: Math.sqrt(sums.r / n),
            g: Math.sqrt(sums.g / n),
            b: Math.sqrt(sums.b / n),
        },
        maxAbs: maxima,
        meanLuminanceError: lumSum / n,
    };
}

