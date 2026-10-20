import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareKineticChart, type KineticChartObservation } from '../src/utils/kineticChart.ts';

function observation(timeMin: number, meanLuminance: number): KineticChartObservation {
    return {
        timeMin,
        meanLuminance,
        meanR: meanLuminance / 2,
        meanG: meanLuminance / 3,
        meanB: meanLuminance / 4,
    };
}

test('empty chart has no baseline or observation trend', () => {
    assert.deepEqual(prepareKineticChart([]), {
        data: [],
        baselineLuminance: null,
        connectObservations: false,
    });
});

test('single observation uses its measured luminance as baseline and has no trend line', () => {
    const result = prepareKineticChart([observation(0, 139.347)]);

    assert.equal(result.baselineLuminance, 139.347);
    assert.equal(result.data[0].meanLuminance, 139.35);
    assert.equal(result.data[0].time, 0);
    assert.equal(result.connectObservations, false);
});

test('multiple distinct timestamps are ordered chronologically and connected', () => {
    const result = prepareKineticChart([
        observation(10, 125),
        observation(0, 140),
        observation(5, 132),
    ]);

    assert.deepEqual(result.data.map(({ time }) => time), [0, 5, 10]);
    assert.equal(result.baselineLuminance, 140);
    assert.equal(result.connectObservations, true);
});

test('duplicate timestamps remain represented but do not imply a connecting trend', () => {
    const result = prepareKineticChart([
        observation(2, 110),
        observation(0, 125),
        observation(2, 108),
    ]);

    assert.deepEqual(result.data.map(({ time }) => time), [0, 2, 2]);
    assert.equal(result.data.length, 3);
    assert.equal(result.baselineLuminance, 125);
    assert.equal(result.connectObservations, false);
});
