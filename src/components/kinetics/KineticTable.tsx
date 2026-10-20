import type { DerivedObservation } from '../../utils/kinetics';

const fmt = (value: number, digits = 1) => value.toFixed(digits);

/** Tabular view of validated observations + derived baseline/rate columns. */
export function KineticTable({ observations }: { observations: DerivedObservation[] }) {
    return (
        <div className="table-responsive overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
                <thead>
                    <tr>
                        <th>time (min)</th>
                        <th>source</th>
                        <th>mean R</th>
                        <th>mean G</th>
                        <th>mean B</th>
                        <th>luminance</th>
                        <th>Δ baseline</th>
                        <th>rate /min</th>
                        <th>normalized</th>
                        <th>flags</th>
                    </tr>
                </thead>
                <tbody>
                    {observations.map((obs, i) => {
                        const flags: string[] = [];
                        if (i === 0) flags.push('baseline');
                        if (obs.resampled) flags.push('resampled');
                        if (obs.calibrated) flags.push('calibrated');
                        if (!obs.roi) flags.push('no ROI metadata');
                        for (const w of obs.warnings) flags.push(w);
                        return (
                            <tr key={`${obs.timeMin}-${obs.source}-${i}`}>
                                <td className="mono whitespace-nowrap">{fmt(obs.timeMin, 2)}</td>
                                <td className="max-w-[220px] truncate text-[12.5px]">{obs.source}</td>
                                <td className="mono">{fmt(obs.meanR)}</td>
                                <td className="mono">{fmt(obs.meanG)}</td>
                                <td className="mono">{fmt(obs.meanB)}</td>
                                <td className="mono font-semibold text-white">
                                    {fmt(obs.meanLuminance)}
                                </td>
                                <td className="mono">
                                    {obs.deltaFromBaseline >= 0 ? '+' : ''}
                                    {fmt(obs.deltaFromBaseline, 2)}
                                </td>
                                <td className="mono">
                                    {obs.ratePerMinute === null
                                        ? '—'
                                        : `${obs.ratePerMinute >= 0 ? '+' : ''}${fmt(obs.ratePerMinute, 3)}`}
                                </td>
                                <td className="mono">
                                    {obs.normalizedChange === null
                                        ? 'n/a (zero baseline)'
                                        : `${obs.normalizedChange >= 0 ? '+' : ''}${(obs.normalizedChange * 100).toFixed(2)}%`}
                                </td>
                                <td className="max-w-[260px] text-[11.5px] text-txt-muted">
                                    {flags.length > 0 ? flags.join(' · ') : '—'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
