/**
 * Luminance time-course chart for validated kinetic series.
 * Mean luminance is always plotted; R/G/B are optional toggles.
 */
import { useState } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useReducedMotion } from 'motion/react';
import type { DerivedObservation } from '../../utils/kinetics';
import { prepareKineticChart } from '../../utils/kineticChart';

const COLORS = {
    meanLuminance: '#00f2fe',
    meanR: '#f87171',
    meanG: '#4ade80',
    meanB: '#60a5fa',
} as const;

type SeriesKey = keyof typeof COLORS;

const SERIES: Array<{ key: SeriesKey; label: string }> = [
    { key: 'meanLuminance', label: 'Mean luminance' },
    { key: 'meanR', label: 'Mean R' },
    { key: 'meanG', label: 'Mean G' },
    { key: 'meanB', label: 'Mean B' },
];

interface TooltipEntry {
    name?: string | number;
    value?: number | string;
    color?: string;
}

function ChartTooltip(props: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
}) {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="rounded-lg border border-line bg-[rgba(5,12,26,0.95)] px-3 py-2 backdrop-blur-md">
            <p className="mono mb-1 text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                {label} min
            </p>
            {payload.map((entry, index) => (
                <p key={index} className="mono flex items-center gap-2 text-[12.5px] text-txt">
                    <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ background: entry.color ?? COLORS.meanLuminance }}
                    />
                    {entry.name}: <span className="text-white">{entry.value}</span>
                </p>
            ))}
        </div>
    );
}
export function KineticSeriesChart({
    observations,
    height = 320,
}: {
    observations: DerivedObservation[];
    height?: number;
}) {
    const reduceMotion = useReducedMotion();
    const [enabled, setEnabled] = useState<Record<SeriesKey, boolean>>({
        meanLuminance: true,
        meanR: false,
        meanG: false,
        meanB: false,
    });

    const { data, baselineLuminance, connectObservations } = prepareKineticChart(observations);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart series">
                {SERIES.map((series) => {
                    const on = enabled[series.key];
                    return (
                        <button
                            key={series.key}
                            type="button"
                            onClick={() =>
                                setEnabled((current) => ({ ...current, [series.key]: !current[series.key] }))
                            }
                            aria-pressed={on}
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
                                style={{ background: COLORS[series.key], opacity: on ? 1 : 0.35 }}
                            />
                            {series.label}
                        </button>
                    );
                })}
            </div>
            <div style={{ height }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                            dataKey="time"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                            label={{ value: 'elapsed time (min)', position: 'insideBottomRight', offset: -10, fill: '#64748b', fontSize: 11 }}
                        />
                        <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={46}
                            domain={[0, 255]}
                        />
                        {enabled.meanLuminance && baselineLuminance !== null ? (
                            <ReferenceLine
                                y={baselineLuminance}
                                stroke="#fbbf24"
                                strokeWidth={2}
                                strokeDasharray="7 4"
                                ifOverflow="extendDomain"
                                label={{
                                    value: `Mean luminance baseline (${baselineLuminance.toFixed(2)})`,
                                    position: 'insideTopRight',
                                    fill: '#fbbf24',
                                    fontSize: 11,
                                }}
                            />
                        ) : null}
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(0,242,254,0.35)', strokeWidth: 1 }} />
                        {(Object.keys(COLORS) as SeriesKey[]).map((key) =>
                            enabled[key] ? (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    name={SERIES.find((s) => s.key === key)?.label ?? key}
                                    stroke={connectObservations ? COLORS[key] : 'transparent'}
                                    strokeWidth={key === 'meanLuminance' ? 2.5 : 1.75}
                                    dot={{ r: 3, fill: COLORS[key], strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: COLORS[key], strokeWidth: 0 }}
                                    isAnimationActive={!reduceMotion}
                                    animationDuration={700}
                                    connectNulls={false}
                                />
                            ) : null,
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
