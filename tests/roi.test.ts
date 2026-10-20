import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampRoiToImage, summarizeRgbaPixels } from '../src/utils/roiStatistics.ts';
import { clampRect, clientToImagePoint, normalizeRect } from '../src/utils/roiGeometry.ts';

test('ROI sampling clamps partial overflow and rejects empty or non-finite rectangles', () => {
    assert.deepEqual(clampRoiToImage({ x: 8.2, y: 7.1, width: 5, height: 8 }, 10, 10), {
        sx: 8, sy: 7, sw: 2, sh: 3,
    });
    assert.equal(clampRoiToImage({ x: 0, y: 0, width: 0, height: 2 }, 10, 10), null);
    assert.equal(clampRoiToImage({ x: Number.NaN, y: 0, width: 2, height: 2 }, 10, 10), null);
    assert.equal(clampRoiToImage({ x: 0, y: 0, width: 2, height: 2 }, 0, 10), null);
    assert.equal(clampRoiToImage({ x: 10, y: 0, width: 2, height: 2 }, 10, 10), null);
    assert.equal(clampRoiToImage({ x: 0, y: 10, width: 2, height: 2 }, 10, 10), null);
    assert.equal(clampRoiToImage({ x: -5, y: 0, width: 2, height: 2 }, 10, 10), null);
    assert.equal(clampRoiToImage({ x: 0, y: -5, width: 2, height: 2 }, 10, 10), null);
    assert.deepEqual(clampRoiToImage({ x: -2, y: -1, width: 4, height: 3 }, 10, 10), {
        sx: 0, sy: 0, sw: 2, sh: 2,
    });
});

test('ROI drag geometry handles reverse drags and maps preview coordinates to source pixels', () => {
    const rect = normalizeRect(8, 7, 2, 1);
    assert.deepEqual(rect, { x: 2, y: 1, width: 6, height: 6 });
    assert.deepEqual(clampRect(rect, 5, 4), { x: 2, y: 1, width: 3, height: 3 });
    assert.deepEqual(
        clientToImagePoint(60, 45, { left: 10, top: 5, width: 100, height: 50 }, 200, 100),
        { x: 100, y: 80 },
    );
});

test('RGBA statistics use pixel means and sample luminance deviation', () => {
    const stats = summarizeRgbaPixels(new Uint8ClampedArray([
        0, 0, 0, 255,
        255, 255, 255, 255,
    ]));
    assert.ok(stats);
    assert.equal(stats.samples, 2);
    assert.equal(stats.meanR, 127.5);
    assert.equal(stats.meanG, 127.5);
    assert.equal(stats.meanB, 127.5);
    assert.ok(Math.abs(stats.meanLuminance - 127.5) < 1e-10);
    assert.ok(Math.abs(
        stats.meanLuminance - (0.2126 * stats.meanR + 0.7152 * stats.meanG + 0.0722 * stats.meanB),
    ) < 1e-10);
    assert.ok(Math.abs(stats.minLuminance) < 1e-10);
    assert.ok(Math.abs(stats.maxLuminance - 255) < 1e-10);
    assert.ok(Math.abs(stats.luminanceStdDev - 255 / Math.sqrt(2)) < 1e-10);

    const singleton = summarizeRgbaPixels([0, 100, 0, 255]);
    assert.ok(singleton);
    assert.ok(Math.abs(singleton.meanLuminance - 71.52) < 1e-10);
    assert.equal(singleton.luminanceStdDev, 0);
});

test('ROI luminance mean stays within true extrema for varied pixels and black pixels', () => {
    const varied = summarizeRgbaPixels(new Uint8ClampedArray([
        34, 177, 76, 255,
        20, 100, 200, 255,
        255, 20, 0, 255,
    ]));
    assert.ok(varied);
    assert.ok(varied.minLuminance <= varied.meanLuminance);
    assert.ok(varied.meanLuminance <= varied.maxLuminance);
    assert.ok(Math.abs(
        varied.meanLuminance -
        (0.2126 * varied.meanR + 0.7152 * varied.meanG + 0.0722 * varied.meanB),
    ) < 1e-10);

    // Repeated 34/177/76 pixels produce a non-integer Rec.709 value; naïve
    // accumulation can place the mean slightly above the identical extrema.
    const repeatedGreen = new Uint8ClampedArray(100 * 4);
    for (let index = 0; index < repeatedGreen.length; index += 4) {
        repeatedGreen[index] = 34;
        repeatedGreen[index + 1] = 177;
        repeatedGreen[index + 2] = 76;
        repeatedGreen[index + 3] = 255;
    }
    const repeated = summarizeRgbaPixels(repeatedGreen);
    assert.ok(repeated);
    assert.ok(repeated.minLuminance <= repeated.meanLuminance);
    assert.ok(repeated.meanLuminance <= repeated.maxLuminance);

    const black = summarizeRgbaPixels(new Uint8ClampedArray([
        0, 0, 0, 255,
        0, 0, 0, 255,
    ]));
    assert.ok(black);
    assert.equal(black.meanLuminance, 0);
    assert.equal(black.minLuminance, 0);
    assert.equal(black.maxLuminance, 0);
});
