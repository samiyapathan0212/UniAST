import { useState } from 'react';
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
import type { KineticPoint } from '../../types';

const CYAN = '#00f2fe';
const VIOLET = '#a855f7';

const SERIES = [
    { key: 'kinetic', label: 'Kinetic signal', color: CYAN },
    { key: 'reference', label: 'Reference', color: VIOLET },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

interface TooltipEntry {
    name?: string | number;
    value?: number | string;
    color?: string;
}

/** Glass-styled chart tooltip (mono numbers, per the design system). */
function KineticTooltip(props: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
}) {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="rounded-lg border border-line bg-[rgba(5,12,26,0.95)] px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <p className="mono mb-1 text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                {label}
            </p>
            {payload.map((entry, index) => (
                <p
                    key={index}
                    className="mono flex items-center gap-2 text-[12.5px] text-txt"
                >
                    <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ background: entry.color ?? CYAN }}
                    />
                    {entry.name}: <span className="text-white">{entry.value}</span>
                </p>
            ))}
        </div>
    );
}

interface KineticLineChartProps {
    data: KineticPoint[];
    height?: number;
}

/**
 * Interactive kinetic line chart: animated lines, glass tooltip and a custom
 * legend that toggles each series on/off (real component state).
 */
export function KineticLineChart({ data, height = 320 }: KineticLineChartProps) {
    const reduceMotion = useReducedMotion();
    const [hidden, setHidden] = useState<Record<SeriesKey, boolean>>({
        kinetic: false,
        reference: false,
    });

    const toggleSeries = (key: SeriesKey) =>
        setHidden((current) => ({ ...current, [key]: !current[key] }));

    return (
        <div className="flex flex-col gap-3">
            <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Chart series"
            >
                {SERIES.map((series) => {
                    const off = hidden[series.key];
                    return (
                        <button
                            key={series.key}
                            type="button"
                            onClick={() => toggleSeries(series.key)}
                            aria-pressed={!off}
                            className={[
                                'mono flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] transition-all duration-200',
                                off
                                    ? 'border-line bg-transparent text-txt-muted opacity-60'
                                    : 'border-line bg-[rgba(255,255,255,0.04)] text-txt',
                            ].join(' ')}
                        >
                            <span
                                aria-hidden="true"
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                    background: series.color,
                                    opacity: off ? 0.35 : 1,
                                }}
                            />
                            {series.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ height }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 8, right: 12, left: -14, bottom: 0 }}
                    >
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
                        />
                        <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={46}
                        />
                        <Tooltip
                            content={<KineticTooltip />}
                            cursor={{ stroke: 'rgba(0,242,254,0.35)', strokeWidth: 1 }}
                        />
                        {!hidden.reference ? (
                            <Line
                                type="monotone"
                                dataKey="reference"
                                name="Reference"
                                stroke={VIOLET}
                                strokeWidth={2}
                                strokeDasharray="5 4"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                isAnimationActive={!reduceMotion}
                                animationDuration={700}
                            />
                        ) : null}
                        {!hidden.kinetic ? (
                            <Line
                                type="monotone"
                                dataKey="kinetic"
                                name="Kinetic"
                                stroke={CYAN}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                isAnimationActive={!reduceMotion}
                                animationDuration={700}
                            />
                        ) : null}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
