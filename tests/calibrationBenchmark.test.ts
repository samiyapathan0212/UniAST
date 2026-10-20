import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateCalibrationBenchmark,
    exportCalibrationBenchmarkCsv,
    parseCalibrationBenchmarkManifest,
    type CalibrationBenchmarkManifest,
    type BenchmarkMeasurement,
} from '../src/utils/calibrationBenchmark.ts';

function manifest(): CalibrationBenchmarkManifest {
    const patches = [
        { patchId: 'patch-a', roi: { x: 1, y: 1, width: 10, height: 10 }, referenceRgb: { r: 20, g: 30, b: 40 } },
        { patchId: 'patch-b', roi: { x: 12, y: 1, width: 10, height: 10 }, referenceRgb: { r: 110, g: 130, b: 150 } },
    ];
    return {
        datasetId: 'dataset,alpha',
        reference: {
            standard: 'User-supplied chart standard',
            source: 'User-supplied reference table',
            colorSpace: 'sRGB',
            encoding: '8-bit',
            illuminant: 'D65',
            observer: '2 degree',
        },
        patchMeasurement: { method: 'Interior rectangular ROI', notes: 'ROIs were manually checked.' },
        calibrationSettings: { model: 'per-channel affine least squares', version: 'test-1' },
        limitations: ['Test fixture only; not laboratory evidence.'],
        images: [
            { imageId: 'fit-image', file: 'fit.png', role: 'fit', captureSettings: { device: 'test camera' }, patches: patches.map((patch) => ({ ...patch, roi: { ...patch.roi }, referenceRgb: { ...patch.referenceRgb } })) },
            { imageId: 'validation-image', file: 'validation.png', role: 'validation', captureSettings: { device: 'test camera' }, patches: patches.map((patch) => ({ ...patch, roi: { ...patch.roi }, referenceRgb: { ...patch.referenceRgb } })) },
        ],
    };
}

function measurements(validationOffset = 0): BenchmarkMeasurement[] {
    return [
        { imageId: 'fit-image', patchId: 'patch-a', measuredRgb: { r: 10, g: 20, b: 30 }, sampleCount: 100 },
        { imageId: 'fit-image', patchId: 'patch-b', measuredRgb: { r: 100, g: 120, b: 140 }, sampleCount: 100 },
        { imageId: 'validation-image', patchId: 'patch-a', measuredRgb: { r: 10 + validationOffset, g: 20, b: 30 }, sampleCount: 100 },
        { imageId: 'validation-image', patchId: 'patch-b', measuredRgb: { r: 100, g: 120, b: 140 }, sampleCount: 100 },
    ];
}

test('benchmark manifest requires sourced sRGB references, annotations, and image-level held-out split', () => {
    const valid = manifest();
    assert.equal(parseCalibrationBenchmarkManifest(valid).ok, true);

    const missingReference = { ...valid, reference: { ...valid.reference, source: '' } };
    const missingSource = parseCalibrationBenchmarkManifest(missingReference);
    assert.equal(missingSource.ok, false);
    if (!missingSource.ok) assert.match(missingSource.errors.join(' '), /reference\.source/);

    const wrongEncoding = { ...valid, reference: { ...valid.reference, encoding: 'linear RGB' } };
    assert.equal(parseCalibrationBenchmarkManifest(wrongEncoding).ok, false);

    const outOfRangeReference = manifest();
    outOfRangeReference.images[0].patches[0].referenceRgb.r = 256;
    assert.equal(parseCalibrationBenchmarkManifest(outOfRangeReference).ok, false);

    const fractionalRoi = manifest();
    fractionalRoi.images[0].patches[0].roi.x = 1.5;
    assert.equal(parseCalibrationBenchmarkManifest(fractionalRoi).ok, false);

    const noHeldOutImage = { ...valid, images: valid.images.filter((image) => image.role === 'fit') };
    const missingValidation = parseCalibrationBenchmarkManifest(noHeldOutImage);
    assert.equal(missingValidation.ok, false);
    if (!missingValidation.ok) assert.match(missingValidation.errors.join(' '), /independent validation image/);

    const unsafePath = manifest();
    unsafePath.images[0].file = '../outside.png';
    assert.equal(parseCalibrationBenchmarkManifest(unsafePath).ok, false);

    const inconsistent = manifest();
    inconsistent.images[1].patches[0].referenceRgb.r += 1;
    assert.equal(parseCalibrationBenchmarkManifest(inconsistent).ok, false);
});

test('benchmark computes raw and calibrated RGB RMSE separately for fit and held-out images', () => {
    const result = calculateCalibrationBenchmark(manifest(), measurements());
    assert.deepEqual(calculateCalibrationBenchmark(manifest(), measurements()), result);
    assert.equal(result.fitImageIds.join(','), 'fit-image');
    assert.equal(result.validationImageIds.join(','), 'validation-image');
    assert.equal(result.fitPatchCount, 2);
    assert.equal(result.validationPatchCount, 2);
    assert.equal(result.fitRawRgbRmse, 10);
    assert.ok(result.fitCalibratedRgbRmse < 1e-10);
    assert.equal(result.validationRawRgbRmse, 10);
    assert.ok(result.validationCalibratedRgbRmse < 1e-10);
    assert.equal(result.rows[0].role, 'fit');
    assert.equal(result.rows[1].role, 'validation');
    assert.equal(result.rows[1].rawRgbRmse, 10);
    assert.ok(result.rows[1].calibratedRgbRmse < 1e-10);
    assert.match(result.method, /sRGB code values/);
    assert.ok(result.limitations.some((item) => item.includes('not a perceptual')));
});

test('validation measurements do not affect the fitted model or fit error', () => {
    const baseline = calculateCalibrationBenchmark(manifest(), measurements());
    const changedValidation = calculateCalibrationBenchmark(manifest(), measurements(15));
    assert.deepEqual(changedValidation.model, baseline.model);
    assert.equal(changedValidation.fitCalibratedRgbRmse, baseline.fitCalibratedRgbRmse);
    assert.notEqual(changedValidation.validationCalibratedRgbRmse, baseline.validationCalibratedRgbRmse);
});

test('benchmark rejects incomplete or invalid measurements and non-identifiable fits', () => {
    assert.throws(() => calculateCalibrationBenchmark(manifest(), measurements().slice(1)), /Missing 1 patch measurement/);
    const invalid = measurements();
    invalid[0].measuredRgb.r = 256;
    assert.throws(() => calculateCalibrationBenchmark(manifest(), invalid), /is invalid/);

    const degenerate = measurements().map((measurement) => ({
        ...measurement,
        measuredRgb: { r: 50, g: 50, b: 50 },
    }));
    assert.throws(() => calculateCalibrationBenchmark(manifest(), degenerate), /not identifiable/);
});

test('benchmark CSV exports stable identifiers, settings, method, and limitations', () => {
    const report = calculateCalibrationBenchmark(manifest(), measurements());
    const csv = exportCalibrationBenchmarkCsv(report);
    assert.equal(exportCalibrationBenchmarkCsv(calculateCalibrationBenchmark(manifest(), measurements())), csv);
    assert.match(csv, /dataset_id,image_id,image_file,split/);
    assert.match(csv, /"dataset,alpha",fit-image,fit\.png,fit/);
    assert.match(csv, /validation-image,validation\.png,validation/);
    assert.match(csv, /raw_rgb_rmse_srgb_code_values/);
    assert.match(csv, /User-supplied/);
    assert.match(csv, /Test fixture only; not laboratory evidence\./);
});
