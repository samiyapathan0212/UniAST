import type { DerivedObservation } from './kinetics';

export type KineticChartObservation = Pick<
    DerivedObservation,
    'timeMin' | 'meanLuminance' | 'meanR' | 'meanG' | 'meanB'
>;

export interface KineticChartPoint {
    time: number;
    meanLuminance: number;
    meanR: number;
    meanG: number;
    meanB: number;
}

export interface PreparedKineticChart {
    data: KineticChartPoint[];
    baselineLuminance: number | null;
    connectObservations: boolean;
}

/** Prepare actual observations in elapsed-time order without adding values. */
export function prepareKineticChart(
    observations: readonly KineticChartObservation[],
): PreparedKineticChart {
    const ordered = [...observations].sort((left, right) => left.timeMin - right.timeMin);
    const distinctTimes = ordered.every(
        (observation, index) =>
            Number.isFinite(observation.timeMin) &&
            (index === 0 || observation.timeMin > ordered[index - 1].timeMin),
    );

    return {
        data: ordered.map((observation) => ({
            time: observation.timeMin,
            meanLuminance: Number(observation.meanLuminance.toFixed(2)),
            meanR: Number(observation.meanR.toFixed(2)),
            meanG: Number(observation.meanG.toFixed(2)),
            meanB: Number(observation.meanB.toFixed(2)),
        })),
        baselineLuminance: ordered[0]?.meanLuminance ?? null,
        connectObservations: ordered.length > 1 && distinctTimes,
    };
}
