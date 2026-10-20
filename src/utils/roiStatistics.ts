import type { RoiRect, RoiStatistics } from '../types';

/**
 * Maximum number of pixel samples evaluated per ROI.
 *
 * Exact 1:1 sampling is used whenever the region holds at most this many
 * pixels. Larger regions are drawn into a scratch canvas at a reduced size
 * (browser bilinear downscale) so the synchronous pass never exceeds roughly
 * this budget — keeping the UI responsive for very large selections.
 */
export const MAX_SAMPLE_PIXELS = 400_000;
export const IMAGE_ANALYSIS_METHOD_VERSION = 'roi-rec709-v1';

/** Rec.709 luminance weights on 8-bit sRGB channel values. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export type SampleRect = {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
};

/** Summarize RGBA pixel samples; exported for deterministic numerical tests. */
export function summarizeRgbaPixels(data: ArrayLike<number>): RoiStatistics | null {
    const pixelCount = Math.floor(data.length / 4);
    if (pixelCount === 0) return null;
    let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumL2 = 0;
    let minL = Number.POSITIVE_INFINITY, maxL = Number.NEGATIVE_INFINITY;
    for (let i = 0; i + 3 < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b;
        sumR += r; sumG += g; sumB += b; sumL += luma; sumL2 += luma * luma;
        minL = Math.min(minL, luma); maxL = Math.max(maxL, luma);
    }
    // Floating-point summation can put the mean a few ULPs outside the exact
    // observed interval (for example, many identical non-integer luminances).
    // The arithmetic mean is mathematically bounded by these extrema, so clamp
    // only this round-off artifact; the per-pixel Rec.709 calculation remains
    // unchanged and no display-rounded values enter the result.
    const meanL = Math.min(maxL, Math.max(minL, sumL / pixelCount));
    const variance = pixelCount > 1 ? (sumL2 - (sumL * sumL) / pixelCount) / (pixelCount - 1) : 0;
    return {
        samples: pixelCount,
        resampled: false,
        meanR: sumR / pixelCount,
        meanG: sumG / pixelCount,
        meanB: sumB / pixelCount,
        meanLuminance: meanL,
        luminanceStdDev: Math.sqrt(Math.max(variance, 0)),
        minLuminance: minL,
        maxLuminance: maxL,
    };
}

/** Clamp an ROI to the image bounds; returns null for degenerate regions. */
export function clampRoiToImage(
    roi: RoiRect,
    naturalWidth: number,
    naturalHeight: number,
): SampleRect | null {
    if (
        !Number.isFinite(roi.x) || !Number.isFinite(roi.y) ||
        !Number.isFinite(roi.width) || !Number.isFinite(roi.height) ||
        !Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) ||
        naturalWidth < 1 || naturalHeight < 1 || roi.width <= 0 || roi.height <= 0
    ) return null;
    const imageWidth = Math.floor(naturalWidth);
    const imageHeight = Math.floor(naturalHeight);
    const left = Math.floor(roi.x);
    const top = Math.floor(roi.y);
    const right = left + Math.ceil(roi.width);
    const bottom = top + Math.ceil(roi.height);
    if (right <= 0 || bottom <= 0 || left >= imageWidth || top >= imageHeight) return null;

    const x = Math.max(0, left);
    const y = Math.max(0, top);
    const sw = Math.min(right, imageWidth) - x;
    const sh = Math.min(bottom, imageHeight) - y;
    if (sw < 1 || sh < 1) return null;
    return { sx: x, sy: y, sw, sh };
}

/**
 * Compute mean RGB, mean luminance and luminance dispersion for the pixels
 * INSIDE `roi` of `image`.
 *
 * - Mean RGB: arithmetic mean of 8-bit R/G/B values over the sampled pixels.
 * - Luminance per pixel: Y = 0.2126·R + 0.7152·G + 0.0722·B (ITU-R BT.709
 *   coefficients applied to non-linear sRGB 0–255 values), reported on 0–255.
 * - Dispersion: sample standard deviation of per-pixel Y (divisor n−1).
 *
 * Returns null when the region is empty/out of bounds or the canvas cannot
 * be read (should not happen — object URLs are same-origin).
 */
export function computeRoiStatistics(
    image: HTMLImageElement,
    roi: RoiRect,
): RoiStatistics | null {
    const region = clampRoiToImage(roi, image.naturalWidth, image.naturalHeight);
    if (!region) return null;

    const { sx, sy, sw, sh } = region;
    const area = sw * sh;
    const scale = area > MAX_SAMPLE_PIXELS ? Math.sqrt(area / MAX_SAMPLE_PIXELS) : 1;
    const dw = Math.max(1, Math.round(sw / scale));
    const dh = Math.max(1, Math.round(sh / scale));

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);

    let data: Uint8ClampedArray;
    try {
        data = context.getImageData(0, 0, dw, dh).data;
    } catch {
        return null;
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }

    const result = summarizeRgbaPixels(data);
    return result ? { ...result, resampled: scale > 1 } : null;
}
