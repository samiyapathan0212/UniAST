import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useReducedMotion } from 'motion/react';
import type { DeviceComparison } from '../../types';

const BEFORE = '#3b82f6';
const AFTER = '#00f2fe';

interface TooltipEntry {
    name?: string | number;
    value?: number | string;
    color?: string;
}

/** Glass-styled tooltip for the device comparison chart. */
function DeviceTooltip(props: {
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
                        style={{ background: entry.color ?? AFTER }}
                    />
                    {entry.name}: <span className="text-white">{entry.value}</span> ΔE
                </p>
            ))}
        </div>
    );
}

interface DeviceComparisonChartProps {
    data: DeviceComparison[];
    height?: number;
}

/** Grouped bar chart comparing mean colour error before/after calibration. */
export function DeviceComparisonChart({
    data,
    height = 320,
}: DeviceComparisonChartProps) {
    const reduceMotion = useReducedMotion();

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-4" aria-hidden="true">
                <span className="mono flex items-center gap-2 text-[11.5px] text-txt-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: BEFORE }} />
                    Pre-calibration ΔE
                </span>
                <span className="mono flex items-center gap-2 text-[11.5px] text-txt-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: AFTER }} />
                    Post-calibration ΔE
                </span>
            </div>

            <div style={{ height }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                        barGap={4}
                    >
                        <CartesianGrid
                            strokeDasharray="3 6"
                            stroke="rgba(255,255,255,0.06)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="device"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                            interval={0}
                            angle={-18}
                            textAnchor="end"
                            height={54}
                        />
                        <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={46}
                        />
                        <Tooltip
                            content={<DeviceTooltip />}
                            cursor={{ fill: 'rgba(0,242,254,0.05)' }}
                        />
                        <Bar
                            dataKey="preCalibration"
                            name="Pre-calibration"
                            fill={BEFORE}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={26}
                            isAnimationActive={!reduceMotion}
                            animationDuration={700}
                        />
                        <Bar
                            dataKey="postCalibration"
                            name="Post-calibration"
                            fill={AFTER}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={26}
                            isAnimationActive={!reduceMotion}
                            animationDuration={700}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
