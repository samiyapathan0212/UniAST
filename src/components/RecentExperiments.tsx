import { useState } from 'react';
import { Badge, DemoTag } from './Badge';
import { EmptyState } from './EmptyState';
import type { ExperimentRecord, ExperimentStatus } from '../types';

const FILTER_OPTIONS = ['All statuses', 'Pass', 'Pending', 'Alert'] as const;

const FILTER_TO_STATUS: Record<string, ExperimentStatus | undefined> = {
    'All statuses': undefined,
    Pass: 'pass',
    Pending: 'pending',
    Alert: 'alert',
};

const STATUS_LABEL: Record<ExperimentStatus, string> = {
    pass: 'Pass',
    pending: 'Pending',
    alert: 'Alert',
};

/** Recent experiments table with a working status filter and empty state. */
export function RecentExperiments({ experiments }: { experiments: ExperimentRecord[] }) {
    const [filter, setFilter] = useState<string>('All statuses');
    const status = FILTER_TO_STATUS[filter];

    const rows = status
        ? experiments.filter((experiment) => experiment.status === status)
        : experiments;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-white">
                        Recent experiments
                    </h3>
                    <DemoTag label="DEMO" />
                </div>
                <select
                    aria-label="Filter experiments by status"
                    className="field-input w-[175px] max-w-full py-2.5 text-[13px]"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                >
                    {FILTER_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    title="No experiments match this filter"
                    description={`There are no "${filter}" records in the simulated dataset. Choose a different status to see demo experiments.`}
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-left text-[13.5px]">
                        <thead>
                            <tr className="bg-[rgba(16,32,60,0.7)]">
                                {['ID', 'Experiment', 'Device', 'Status', 'Accuracy', 'Logged'].map(
                                    (column) => (
                                        <th
                                            key={column}
                                            className={`mono border-b border-line px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.5px] text-txt-2 ${
                                                column === 'Logged' ? 'hidden md:table-cell' : ''
                                            }`}
                                        >
                                            {column}
                                        </th>
                                    ),
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((experiment) => (
                                <tr
                                    key={experiment.id}
                                    className="transition-colors hover:bg-[rgba(0,242,254,0.03)]"
                                >
                                    <td className="mono border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-cyan">
                                        {experiment.id}
                                    </td>
                                    <td className="border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-txt">
                                        {experiment.name}
                                    </td>
                                    <td className="border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-txt-2">
                                        {experiment.device}
                                    </td>
                                    <td className="border-b border-[rgba(255,255,255,0.04)] px-4 py-3">
                                        <Badge tone={experiment.status}>
                                            {STATUS_LABEL[experiment.status]}
                                        </Badge>
                                    </td>
                                    <td className="mono border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-txt">
                                        {experiment.accuracy > 0
                                            ? `${experiment.accuracy.toFixed(1)}%`
                                            : '—'}
                                    </td>
                                    <td className="mono hidden border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-txt-muted md:table-cell">
                                        {experiment.createdAt}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
