import type { ReactNode } from 'react';
import { DemoTag } from './Badge';
import { usePointerGlow } from './usePointerGlow';

interface MetricCardProps {
    label: string;
    value: string;
    unit?: string;
    trend?: string;
    note?: string;
    icon?: ReactNode;
    /** Marks the figure as simulated demo data (Milestone 1 default: true). */
    simulated?: boolean;
}

/** KPI metric card — numbers always render in monospace per the design system. */
export function MetricCard({
    label,
    value,
    unit,
    trend,
    note,
    icon,
    simulated = true,
}: MetricCardProps) {
    const { ref, onMouseMove } = usePointerGlow<HTMLDivElement>();

    return (
        <div
            ref={ref}
            onMouseMove={onMouseMove}
            className="card card-hover glow-card flex min-h-[145px] flex-col justify-between"
        >
            <div className="relative z-[2] flex items-start justify-between gap-2">
                <span className="mono flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.8px] text-txt-2">
                    {icon ? (
                        <span className="text-cyan" aria-hidden="true">
                            {icon}
                        </span>
                    ) : null}
                    {label}
                </span>
                {simulated ? <DemoTag /> : null}
            </div>

            <div className="relative z-[2] mono my-2 flex items-baseline gap-1.5 text-[32px] font-bold text-white">
                {value}
                {unit ? (
                    <span className="text-[15px] font-normal text-txt-muted">{unit}</span>
                ) : null}
            </div>

            <div className="relative z-[2] flex flex-col gap-1">
                {trend ? (
                    <span className="flex items-center gap-1 text-[12px] text-txt-muted">
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M7 17 17 7M9 7h8v8" />
                        </svg>
                        {trend}
                    </span>
                ) : null}
                {note ? (
                    <span className="text-[11.5px] text-txt-muted">{note}</span>
                ) : null}
            </div>
        </div>
    );
}
