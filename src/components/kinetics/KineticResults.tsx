/**
 * Kinetic results: responsive luminance-vs-time chart with R/G/B toggles,
 * descriptive summary cards, measurement table, and CSV export.
 */
import { useMemo, useState } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useReducedMotion } from 'motion/react';
import { Button } from '../Button';
import { GlassCard } from '../GlassCard';
import { MetricCard } from '../MetricCard';
import { KineticTable } from './KineticTable';
import {
    exportKineticsCsv,
    summarizeSeries,
    type ValidatedSeries,
} from '../../utils/kinetics';

const SERIES = [
    { key: 'meanLuminance', label: 'Luminance', color: '#00f2fe' },
    { key: 'meanR', label: 'R', color: '#f87171' },
    { key: 'meanG', label: 'G', color: '#4ade80' },
    { key: 'meanB', label: 'B', color: '#3b82f6' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

interface TooltipEntry {
    name?: string | number;
    value?: number | string;
    color?: string;
}

function ResultsTooltip(props: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
}) {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="rounded-lg border border-line bg-[rgba(5,12,26,0.95)] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <p className="mono mb-1 text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                t = {label} min
            </p>
            {payload.map((entry, index) => (
                <p key={index} className="mono flex items-center gap-2 text-[12.5px] text-txt">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: entry.color ?? '#00f2fe' }} />
                    {entry.name}: <span className="text-white">{entry.value}</span>
                </p>
            ))}
        </div>
    );
}

const fmt = (value: number | null, digits = 2, suffix = '') =>
    value === null ? 'n/a' : `${value.toFixed(digits)}${suffix}`;

interface KineticResultsProps {
    series: ValidatedSeries;
    calibrated: boolean;
    originLabel: string;
}

export function KineticResults({ series, calibrated, originLabel }: KineticResultsProps) {
    const reduceMotion = useReducedMotion();
    const [hidden, setHidden] = useState<Record<SeriesKey, boolean>>({
        meanLuminance: false,
        meanR: true,
        meanG: true,
        meanB: true,
    });
    const [exported, setExported] = useState(false);
    const summary = useMemo(() => summarizeSeries(series), [series]);
    const chartData = useMemo(
        () =>
            series.observations.map((obs) => ({
                time: obs.timeMin,
                meanLuminance: Number(obs.meanLuminance.toFixed(2)),
                meanR: Number(obs.meanR.toFixed(2)),
                meanG: Number(obs.meanG.toFixed(2)),
                meanB: Number(obs.meanB.toFixed(2)),
            })),
        [series],
    );

    const doExport = () => {
        const blob = new Blob([exportKineticsCsv(series, calibrated)], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'uniast_kinetics_export.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setExported(true);
    };
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Observations"
                    value={String(summary.count)}
                    note="Validated points in the series"
                    simulated={false}
                />
                <MetricCard
                    label="Time span"
                    value={fmt(summary.timeSpanMin, 1)}
                    unit="min"
                    note="Elapsed time from first to last point"
                    simulated={false}
                />
                <MetricCard
                    label="Baseline luminance"
                    value={fmt(summary.baselineLuminance)}
                    note="Mean luminance of the first observation"
                    simulated={false}
                />
                <MetricCard
                    label="Absolute change"
                    value={fmt(summary.absoluteChange)}
                    note="Final minus baseline, in luminance units"
                    simulated={false}
                />
            </div>
            {/* --- Chart --------------------------------------------------- */}
            <GlassCard
                glow
                title="Luminance over time"
                action={
                    <span className="mono text-[11.5px] text-txt-muted">
                        origin: {originLabel}
                    </span>
                }
            >
                <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Chart series">
                    {SERIES.map((s) => {
                        const on = !hidden[s.key];
                        return (
                            <button
                                key={s.key}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    setHidden((current) => ({
                                        ...current,
                                        [s.key]: !current[s.key],
                                    }))
                                }
                                className={[
                                    'mono flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px]',
                                    on
                                        ? 'border-line bg-[rgba(255,255,255,0.04)] text-txt'
                                        : 'border-line bg-transparent text-txt-muted opacity-60',
                                ].join(' ')}
                            >
                                <span
                                    aria-hidden="true"
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ background: s.color, opacity: on ? 1 : 0.35 }}
                                />
                                {s.label}
                            </button>
                        );
                    })}
                </div>
                <div style={{ height: 320 }} className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 20 }}>
                            <CartesianGrid
                                strokeDasharray="3 6"
                                stroke="rgba(255,255,255,0.06)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="time"
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                                label={{
                                    value: 'elapsed time (min)',
                                    position: 'insideBottomRight',
                                    offset: -10,
                                    fill: '#64748b',
                                    fontSize: 11,
                                }}
                            />
                            <YAxis
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                width={46}
                                domain={[0, 255]}
                            />
                            <Tooltip
                                content={<ResultsTooltip />}
                                cursor={{ stroke: 'rgba(0,242,254,0.35)', strokeWidth: 1 }}
                            />
                            {SERIES.map((s) =>
                                hidden[s.key] ? null : (
                                    <Line
                                        key={s.key}
                                        type="monotone"
                                        dataKey={s.key}
                                        name={s.label}
                                        stroke={s.color}
                                        strokeWidth={s.key === 'meanLuminance' ? 2.5 : 1.75}
                                        dot={{ r: 3, strokeWidth: 0 }}
                                        activeDot={{ r: 5, strokeWidth: 0 }}
                                        isAnimationActive={!reduceMotion}
                                        animationDuration={700}
                                        connectNulls={false}
                                    />
                                ),
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <p className="mono mt-3 text-[11.5px] leading-relaxed text-txt-muted">
                    Descriptive optical time series only — the slope is a rate of optical
                    change, not a growth rate.
                </p>
            </GlassCard>

            {/* --- Table + export ------------------------------------------ */}
            <GlassCard
                glow
                title="Measurements"
                action={
                    <Button variant="secondary" size="sm" onClick={doExport}>
                        {exported ? 'Exported ✓' : 'Export CSV'}
                    </Button>
                }
            >
                <KineticTable observations={series.observations} />
            </GlassCard>
        </div>
    );
}


