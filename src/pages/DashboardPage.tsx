import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { DemoTag } from '../components/Badge';
import { GlassCard } from '../components/GlassCard';
import { LoadingState } from '../components/LoadingState';
import { MetricCard } from '../components/MetricCard';
import { NewExperimentModal } from '../components/NewExperimentModal';
import { PageHeader } from '../components/PageHeader';
import { RecentExperiments } from '../components/RecentExperiments';
import { StaggerGroup, StaggerItem } from '../components/Reveal';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { DeviceComparisonChart } from '../components/charts/DeviceComparisonChart';
import { KineticLineChart } from '../components/charts/KineticLineChart';
import {
    DEVICE_COMPARISON,
    KINETIC_SERIES,
    RECENT_EXPERIMENTS,
    SUMMARY_METRICS,
    WORKFLOW_STEPS,
} from '../data/demo';
import type {
    ExperimentRecord,
    KineticRange,
    NewExperimentInput,
    PageId,
} from '../types';

interface DashboardPageProps {
    onNavigate: (page: PageId) => void;
}

const RANGES: KineticRange[] = ['1h', '24h', '7d'];

const LOAD_DELAY_MS = 700;

/** Dashboard: welcome header, demo metrics, charts, experiments, workflow. */
export function DashboardPage({ onNavigate }: DashboardPageProps) {
    const [reloadKey, setReloadKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<KineticRange>('24h');
    const [modalOpen, setModalOpen] = useState(false);
    const [stepId, setStepId] = useState(WORKFLOW_STEPS[2].id);
    const [experiments, setExperiments] = useState<ExperimentRecord[]>(
        RECENT_EXPERIMENTS,
    );

    // Simulated async load of the demo dataset (re-triggered by "Refresh").
    useEffect(() => {
        setLoading(true);
        const timer = window.setTimeout(() => setLoading(false), LOAD_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [reloadKey]);

    const createExperiment = (input: NewExperimentInput) => {
        const sequence = 2042 + (experiments.length - RECENT_EXPERIMENTS.length);
        const record: ExperimentRecord = {
            id: `EXP-${sequence}`,
            name: input.name,
            device: input.device,
            status: 'pending',
            accuracy: 0,
            createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            duration: '—',
            simulated: true,
        };
        setExperiments((current) => [record, ...current]);
        setModalOpen(false);
    };

    const selectedStep =
        WORKFLOW_STEPS.find((step) => step.id === stepId) ?? WORKFLOW_STEPS[0];

    return (
        <div>
            <PageHeader
                title={
                    <>
                        Welcome back, Researcher
                        <DemoTag label="DEMO DATA" />
                    </>
                }
                subtitle="Dashboard figures and experiment rows are simulated demo data. Saved research records are managed separately in local sessions."
            >
                <Button variant="primary" onClick={() => setModalOpen(true)}>
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        aria-hidden="true"
                    >
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    New experiment
                </Button>
                <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
                    Refresh demo data
                </Button>
            </PageHeader>

            {/* --- Summary metrics (simulated) ----------------------------- */}
            {loading ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <LoadingState variant="metric" count={4} />
                </div>
            ) : (
                <StaggerGroup className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {SUMMARY_METRICS.map((metric) => (
                        <StaggerItem key={metric.id}>
                            <MetricCard
                                label={metric.label}
                                value={metric.value}
                                unit={metric.unit}
                                trend={metric.trend}
                                note={metric.note}
                            />
                        </StaggerItem>
                    ))}
                </StaggerGroup>
            )}

            {/* --- Charts --------------------------------------------------- */}
            <section className="mt-6 grid gap-5 xl:grid-cols-3">
                <GlassCard
                    glow
                    className="xl:col-span-2"
                    title={
                        <span className="flex items-center gap-2.5">
                            Kinetic signal
                            <DemoTag />
                        </span>
                    }
                    action={
                        <div
                            className="flex overflow-hidden rounded-lg border border-line"
                            role="group"
                            aria-label="Kinetic chart time range"
                        >
                            {RANGES.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setRange(option)}
                                    aria-pressed={range === option}
                                    className={`mono px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                                        range === option
                                            ? 'bg-[rgba(0,242,254,0.14)] text-cyan'
                                            : 'text-txt-muted hover:text-txt-2'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    }
                >
                    {loading ? (
                        <LoadingState variant="chart" label="Loading kinetic chart…" />
                    ) : (
                        <KineticLineChart data={KINETIC_SERIES[range]} />
                    )}
                </GlassCard>

                <GlassCard
                    glow
                    title={
                        <span className="flex items-center gap-2.5">
                            Device comparison
                            <DemoTag />
                        </span>
                    }
                >
                    <p className="mb-3 text-[12.5px] text-txt-muted">
                        Mean colour error per device, before and after optical
                        calibration (lower is better).
                    </p>
                    {loading ? (
                        <LoadingState variant="chart" label="Loading device chart…" />
                    ) : (
                        <DeviceComparisonChart data={DEVICE_COMPARISON} />
                    )}
                </GlassCard>
            </section>

            {/* --- Experiments + workflow indicator ------------------------ */}
            <section className="mt-6 grid gap-5 xl:grid-cols-3">
                <GlassCard glow className="xl:col-span-2">
                    {loading ? (
                        <LoadingState variant="list" count={3} label="Loading experiments…" />
                    ) : (
                        <RecentExperiments experiments={experiments} />
                    )}
                </GlassCard>

                <GlassCard
                    glow
                    title="Research workflow"
                    className="h-full"
                    action={
                        <button
                            type="button"
                            onClick={() => onNavigate('workflow')}
                            className="mono text-[11.5px] font-semibold text-cyan underline-offset-4 hover:underline"
                        >
                            Details
                        </button>
                    }
                >
                    <div className="flex flex-col gap-4">
                        <WorkflowStepper
                            steps={WORKFLOW_STEPS}
                            selectedId={stepId}
                            onSelect={setStepId}
                            compact
                        />
                        <div className="rounded-lg border-l-4 border-cyan border-y border-r border-line bg-[rgba(10,24,48,0.85)] px-4 py-3">
                            <p className="mb-1 text-[13.5px] font-bold text-white">
                                {selectedStep.index}. {selectedStep.title}
                            </p>
                            <p className="text-[12.5px] leading-relaxed text-txt-2">
                                {selectedStep.detail}
                            </p>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onNavigate('workflow')}
                        >
                            Open workflow page
                        </Button>
                    </div>
                </GlassCard>
            </section>

            <NewExperimentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreate={createExperiment}
            />
        </div>
    );
}
