/**
 * Calibration math tests — run with Node's built-in test runner:
 *     npm test   (node --test tests/calibration.test.ts)
 * Node ≥ 22.6 strips types natively, so no test framework is installed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    applyCalibration,
    applyChannel,
    fitCalibration,
    fitChannel,
    luminance,
    residualSummary,
} from '../src/utils/calibration.ts';

const eps = (actual: number, expected: number, tolerance = 1e-9) => {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${expected} ± ${tolerance}, got ${actual}`,
    );
};

test('fitChannel: exact two-point line', () => {
    const report = fitChannel([
        { measured: 100, reference: 120 },
        { measured: 150, reference: 170 },
    ]);
    assert.equal(report.status, 'ok');
    assert.ok(report.fit);
    eps(report.fit.slope, 1);
    eps(report.fit.intercept, 20);
    eps(report.residualRms ?? -1, 0);
    assert.equal(report.points, 2);
});

test('fitChannel: least-squares over three points', () => {
    const report = fitChannel([
        { measured: 0, reference: 10 },
        { measured: 10, reference: 20 },
        { measured: 20, reference: 30 },
    ]);
    assert.equal(report.status, 'ok');
    assert.ok(report.fit);
    eps(report.fit.slope, 1);
    eps(report.fit.intercept, 10);
    eps(report.residualRms ?? -1, 0);
});

test('fitChannel: close ROI means remain stable and fitting is reproducible', () => {
    const points = [
        { measured: 128, reference: 50 },
        { measured: 128.000001, reference: 50.000002 },
    ];
    const first = fitChannel(points);
    const repeated = fitChannel(points);
    assert.equal(first.status, 'ok');
    assert.ok(first.fit);
    eps(first.fit.slope, 2, 1e-7);
    eps(first.fit.intercept, -206, 1e-5);
    assert.deepEqual(repeated, first);
});

test('fitChannel: residual RMS and max abs for imperfect fit', () => {
    const report = fitChannel([
        { measured: 0, reference: 0 },
        { measured: 10, reference: 10 },
        { measured: 20, reference: 19 },
    ]);
    assert.equal(report.status, 'ok');
    assert.ok(report.fit);
    eps(report.fit.slope, 0.95);
    eps(report.fit.intercept, 0.5 / 3);
    eps(report.residualRms ?? -1, Math.sqrt(0.05555555555555555), 1e-9);
    eps(report.residualMaxAbs ?? -1, 1 / 3, 1e-9);
});

test('fitChannel: too few points is reported, not fitted', () => {
    const report = fitChannel([{ measured: 10, reference: 12 }]);
    assert.equal(report.status, 'too-few-points');
    assert.equal(report.fit, null);
    assert.equal(report.residualRms, null);
    assert.equal(report.points, 1);
});

test('fitChannel: zero points is too-few-points', () => {
    const report = fitChannel([]);
    assert.equal(report.status, 'too-few-points');
    assert.equal(report.points, 0);
});

test('fitChannel: identical measured values is degenerate', () => {
    const report = fitChannel([
        { measured: 128, reference: 10 },
        { measured: 128, reference: 200 },
    ]);
    assert.equal(report.status, 'degenerate');
    assert.equal(report.fit, null);
    assert.equal(report.distinctMeasured, 1);
});

test('fitChannel: non-finite pairs are ignored', () => {
    const report = fitChannel([
        { measured: Number.NaN, reference: 10 },
        { measured: 100, reference: 100 },
        { measured: 200, reference: 200 },
        { measured: 150, reference: Number.POSITIVE_INFINITY },
    ]);
    assert.equal(report.status, 'ok');
    assert.equal(report.points, 2);
    assert.ok(report.fit);
    eps(report.fit.slope, 1);
    eps(report.fit.intercept, 0);
});

test('fitChannel: finite values outside the 8-bit domain are ignored', () => {
    const report = fitChannel([
        { measured: -1, reference: 10 },
        { measured: 10, reference: 10 },
        { measured: 20, reference: 20 },
        { measured: 300, reference: 30 },
    ]);
    assert.equal(report.status, 'ok');
    assert.equal(report.points, 2);
    assert.ok(report.fit);
    eps(report.fit.slope, 1);
    eps(report.fit.intercept, 0);
});

test('applyChannel: in-range values pass through and report no clipping', () => {
    const result = applyChannel({ slope: 1, intercept: 0 }, 128);
    eps(result.value, 128);
    assert.equal(result.clipped, false);
});

test('applyChannel: clamps above 255 and below 0, flagging clipping', () => {
    const high = applyChannel({ slope: 2, intercept: 50 }, 200); // raw 450
    eps(high.value, 255);
    assert.equal(high.clipped, true);

    const low = applyChannel({ slope: 1, intercept: -100 }, 50); // raw -50
    eps(low.value, 0);
    assert.equal(low.clipped, true);
});

test('fitCalibration: unavailable when any channel is degenerate', () => {
    const model = fitCalibration([
        { measured: { r: 50, g: 10, b: 10 }, reference: { r: 60, g: 10, b: 10 } },
        { measured: { r: 50, g: 200, b: 200 }, reference: { r: 60, g: 200, b: 200 } },
    ]);
    assert.equal(model.r.status, 'degenerate');
    assert.equal(model.g.status, 'ok');
    assert.equal(model.b.status, 'ok');
    assert.equal(model.available, false);
    assert.equal(applyCalibration(model, { r: 1, g: 2, b: 3 }), null);
});

test('fitCalibration + applyCalibration: identity references reproduce measurements', () => {
    const model = fitCalibration([
        { measured: { r: 10, g: 20, b: 30 }, reference: { r: 10, g: 20, b: 30 } },
        { measured: { r: 200, g: 150, b: 80 }, reference: { r: 200, g: 150, b: 80 } },
    ]);
    assert.equal(model.available, true);
    eps(model.r.fit?.slope ?? -1, 1);
    eps(model.r.fit?.intercept ?? -1, 0);

    const applied = applyCalibration(model, { r: 128, g: 64, b: 32 });
    assert.ok(applied);
    eps(applied.corrected.r, 128);
    eps(applied.corrected.g, 64);
    eps(applied.corrected.b, 32);
    assert.equal(applied.clipped, false);
});

test('applyCalibration: reports clipped channels', () => {
    const model = fitCalibration([
        { measured: { r: 0, g: 0, b: 0 }, reference: { r: 50, g: 50, b: 50 } },
        { measured: { r: 100, g: 100, b: 100 }, reference: { r: 150, g: 150, b: 150 } },
    ]);
    assert.equal(model.available, true);

    const applied = applyCalibration(model, { r: 250, g: 250, b: 250 }); // raw 300
    assert.ok(applied);
    eps(applied.corrected.r, 255);
    assert.equal(applied.clipped, true);
    assert.deepEqual(applied.clippedChannels, ['r', 'g', 'b']);
});

test('residualSummary: perfect model yields zero residuals', () => {
    const model = fitCalibration([
        { measured: { r: 10, g: 20, b: 30 }, reference: { r: 10, g: 20, b: 30 } },
        { measured: { r: 200, g: 150, b: 80 }, reference: { r: 200, g: 150, b: 80 } },
    ]);
    const summary = residualSummary(model, [
        { measured: { r: 10, g: 20, b: 30 }, reference: { r: 10, g: 20, b: 30 } },
        { measured: { r: 200, g: 150, b: 80 }, reference: { r: 200, g: 150, b: 80 } },
    ]);
    assert.ok(summary);
    assert.equal(summary.count, 2);
    eps(summary.rms.r, 0);
    eps(summary.rms.g, 0);
    eps(summary.rms.b, 0);
    eps(summary.meanLuminanceError ?? -1, 0);
});

test('residualSummary: known residuals on an identity model', () => {
    const model = fitCalibration([
        { measured: { r: 0, g: 0, b: 0 }, reference: { r: 0, g: 0, b: 0 } },
        { measured: { r: 255, g: 255, b: 255 }, reference: { r: 255, g: 255, b: 255 } },
    ]);
    const summary = residualSummary(model, [
        { measured: { r: 100, g: 100, b: 100 }, reference: { r: 110, g: 100, b: 90 } },
    ]);
    assert.ok(summary);
    eps(summary.rms.r, 10);
    eps(summary.rms.b, 10);
    eps(summary.maxAbs.g, 0);
    eps(summary.meanLuminanceError ?? -1, 1.404, 1e-9);
});

test('residualSummary: null for empty sample set or unavailable model', () => {
    const good = fitCalibration([
        { measured: { r: 0, g: 0, b: 0 }, reference: { r: 0, g: 0, b: 0 } },
        { measured: { r: 100, g: 100, b: 100 }, reference: { r: 100, g: 100, b: 100 } },
    ]);
    assert.equal(residualSummary(good, []), null);

    const bad = fitCalibration([
        { measured: { r: 5, g: 0, b: 0 }, reference: { r: 5, g: 0, b: 0 } },
        { measured: { r: 5, g: 100, b: 100 }, reference: { r: 5, g: 100, b: 100 } },
    ]);
    assert.equal(
        residualSummary(bad, [
            { measured: { r: 5, g: 1, b: 1 }, reference: { r: 5, g: 1, b: 1 } },
        ]),
        null,
    );
});

test('luminance: Rec.709 weights on 8-bit sRGB values', () => {
    eps(luminance({ r: 255, g: 255, b: 255 }), 255, 1e-9);
    eps(luminance({ r: 0, g: 0, b: 0 }), 0, 1e-9);
    eps(luminance({ r: 0, g: 100, b: 0 }), 71.52, 1e-9);
});

