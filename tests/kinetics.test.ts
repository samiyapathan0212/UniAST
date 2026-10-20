/**
 * Kinetic math + CSV tests — run with Node's built-in test runner:
 *     npm test   (node --test tests/calibration.test.ts tests/kinetics.test.ts)
 * Node ≥ 22.6 strips types natively, so no test framework is installed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    baselineChanges,
    exportKineticsCsv,
    findDimensionMismatches,
    kineticCsvTemplate,
    normalizedChanges,
    parseKineticCsv,
    ratesPerMinute,
    summarizeSeries,
    validateAndDeriveSeries,
} from '../src/utils/kinetics.ts';
import { fitCalibration, residualSummary } from '../src/utils/calibration.ts';

const eps = (actual: number, expected: number, tolerance = 1e-9) => {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${expected} ± ${tolerance}, got ${actual}`,
    );
};

const obs = (timeMin: number, luminance: number, source = `f${timeMin}.png`) => ({
    timeMin,
    source,
    meanR: 120,
    meanG: 120,
    meanB: 120,
    meanLuminance: luminance,
});

test('validateAndDeriveSeries: sorts by time and derives baseline/rate', () => {
    const series = validateAndDeriveSeries([obs(60, 110), obs(0, 100), obs(30, 105)]);
    assert.equal(series.issues.length, 0);
    assert.deepEqual(
        series.observations.map((o) => o.timeMin),
        [0, 30, 60],
    );
    assert.deepEqual(
        series.observations.map((o) => o.deltaFromBaseline),
        [0, 5, 10],
    );
    assert.equal(series.observations[0].ratePerMinute, null);
    eps(series.observations[1].ratePerMinute ?? NaN, 5 / 30);
    eps(series.observations[2].ratePerMinute ?? NaN, 5 / 30);
    eps(series.baselineLuminance ?? NaN, 100);
});

test('validateAndDeriveSeries: rejects invalid rows without fabrication', () => {
    const series = validateAndDeriveSeries([
        obs(0, 100),
        { ...obs(30, 105), meanR: Number.NaN },
        { ...obs(45, 300), source: 'too-bright.png' },
        { ...obs(-5, 90), source: 'negative-time.png' },
    ]);
    assert.equal(series.observations.length, 1);
    assert.equal(series.observations[0].timeMin, 0);
    assert.equal(series.issues.length, 3);
});

test('validateAndDeriveSeries: duplicate times are kept with a warning and null rate', () => {
    const series = validateAndDeriveSeries([obs(0, 100, 'a.png'), obs(0, 102, 'b.png'), obs(30, 108, 'c.png')]);
    assert.equal(series.observations.length, 3);
    assert.ok(series.issues.some((issue) => issue.kind === 'duplicate-time'));
    assert.equal(series.observations[1].ratePerMinute, null);
});

test('baselineChanges: absolute change from first value', () => {
    assert.deepEqual(baselineChanges([100, 105, 98]), [0, 5, -2]);
    assert.deepEqual(baselineChanges([]), []);
});

test('ratesPerMinute: adjacent change per minute, null on first/zero gap', () => {
    assert.deepEqual(ratesPerMinute([0, 30, 60], [100, 106, 112]), [null, 0.2, 0.2]);
    assert.deepEqual(ratesPerMinute([0, 0], [100, 105]), [null, null]);
});

test('normalizedChanges: null when baseline is zero', () => {
    assert.deepEqual(normalizedChanges([0, 5, 10]), [null, null, null]);
    const rel = normalizedChanges([100, 110, 90]);
    eps(rel[1] ?? NaN, 0.1);
    eps(rel[2] ?? NaN, -0.1);
});

test('validateAndDeriveSeries: zero baseline yields unavailable normalized change', () => {
    const series = validateAndDeriveSeries([obs(0, 0), obs(30, 10)]);
    assert.ok(series.observations.every((o) => o.normalizedChange === null));
});

test('parseKineticCsv: parses valid rows with roi + source', () => {
    const parsed = parseKineticCsv(kineticCsvTemplate());
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.rows.length, 3);
    assert.deepEqual(parsed.rows[0].roi, { x: 40, y: 30, width: 200, height: 160 });
    assert.equal(parsed.rows[0].source, 'frame_000.png');
});

test('parseKineticCsv: missing columns, bad rows, and empty files reported', () => {
    const missing = parseKineticCsv('time_min,mean_r\n0,10\n');
    assert.ok(missing.errors.some((e) => e.includes('mean_g')));

    const badRow = parseKineticCsv(
        'time_min,mean_r,mean_g,mean_b,mean_luminance\n0,10,10,10,10\n30,xx,10,10,10\n',
    );
    assert.equal(badRow.rows.length, 1);
    assert.equal(badRow.errors.length, 1);

    const empty = parseKineticCsv('   \n');
    assert.equal(empty.errors.length, 1);
});

test('parseKineticCsv: rejects blank required cells and inconsistent luminance; accepts BOM headers', () => {
    const parsed = parseKineticCsv(
        '\uFEFFtime_min,mean_r,mean_g,mean_b,mean_luminance\n0,,10,10,7.9\n1,10,10,10,10\n2,10,10,10,12\n',
    );
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].timeMin, 1);
    assert.equal(parsed.errors.length, 2);
    assert.match(parsed.errors[0], /mean_r/);
    assert.match(parsed.errors[1], /Rec\.709/);
});

test('parseKineticCsv: skips unterminated quoted records with a row error', () => {
    const parsed = parseKineticCsv(
        'time_min,mean_r,mean_g,mean_b,mean_luminance,source\n0,10,10,10,10,"unfinished source\n30,20,20,20,20,valid.png\n',
    );
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].source, 'valid.png');
    assert.equal(parsed.errors.length, 1);
    assert.match(parsed.errors[0], /Row 2: malformed CSV quoting/);
});

test('calibration validation samples remain independent of the fit samples', () => {
    const fitSamples = [
        { measured: { r: 10, g: 10, b: 10 }, reference: { r: 20, g: 20, b: 20 } },
        { measured: { r: 20, g: 20, b: 20 }, reference: { r: 40, g: 40, b: 40 } },
    ];
    const heldOut = [
        { measured: { r: 15, g: 15, b: 15 }, reference: { r: 35, g: 35, b: 35 } },
    ];
    const model = fitCalibration(fitSamples);
    assert.equal(model.fitPatchCount, 2);
    assert.equal(model.r.fit?.slope, 2);
    assert.equal(residualSummary(model, heldOut)?.rms.r, 5);
});

test('exportKineticsCsv: escapes fields and exports only validated values', () => {
    const series = validateAndDeriveSeries([
        { ...obs(0, 100, 'a, "quoted".png'), warnings: ['frame differs: 10x10'] },
        obs(30, 106),
    ]);
    const csv = exportKineticsCsv(series, false);
    assert.ok(csv.includes('# Units:'));
    assert.ok(csv.includes('"a, ""quoted"".png"'));
    const lines = csv.split('\n').filter((l) => l !== '' && !l.startsWith('#'));
    assert.equal(lines.length, 3); // header + 2 rows
});

test('exportKineticsCsv: imports its comments, values, resampling and warnings consistently', () => {
    const series = validateAndDeriveSeries([
        {
            ...obs(0, 100, 'baseline.png'),
            meanR: 100, meanG: 100, meanB: 100,
            roi: { x: 2, y: 3, width: 20, height: 10 },
            resampled: true, calibrated: true,
            warnings: ['large ROI, resampled for performance'],
        },
        {
            ...obs(0, 102, 'duplicate.png'),
            meanR: 102, meanG: 102, meanB: 102,
        },
        {
            ...obs(30, 110),
            meanR: 110, meanG: 110, meanB: 110,
        },
    ]);
    const csv = exportKineticsCsv(series, true);
    const parsed = parseKineticCsv(csv);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.rows.length, 3);
    assert.deepEqual(parsed.rows[0].roi, { x: 2, y: 3, width: 20, height: 10 });
    assert.equal(parsed.rows[0].resampled, true);
    assert.equal(parsed.rows[0].calibrated, true);
    assert.deepEqual(parsed.rows[0].warnings, ['large ROI, resampled for performance']);
    assert.ok(parsed.rows[1].warnings[0].includes('duplicate elapsed time 0 min'));
    const roundTripped = validateAndDeriveSeries(parsed.rows);
    assert.equal(roundTripped.observations[2].ratePerMinute, 8 / 30);
    assert.equal(roundTripped.observations[1].ratePerMinute, null);
    assert.ok(roundTripped.issues.some((issue) => issue.kind === 'duplicate-time'));
});

test('findDimensionMismatches: flags non-matching frames', () => {
    const mismatches = findDimensionMismatches(
        { width: 100, height: 100 },
        [
            { label: 'b.png', width: 100, height: 100 },
            { label: 'c.png', width: 200, height: 100 },
        ],
    );
    assert.deepEqual(mismatches, ['c.png (200x100px)']);
});

test('summarizeSeries: descriptive summary without interpretation', () => {
    const series = validateAndDeriveSeries([obs(0, 100), obs(30, 106), obs(60, 112)]);
    const summary = summarizeSeries(series);
    assert.equal(summary.count, 3);
    assert.equal(summary.timeSpanMin, 60);
    eps(summary.absoluteChange ?? NaN, 12);
    eps(summary.meanRatePerMinute ?? NaN, 0.2);
    const empty = summarizeSeries(validateAndDeriveSeries([]));
    assert.equal(empty.count, 0);
    assert.equal(empty.baselineLuminance, null);
});
