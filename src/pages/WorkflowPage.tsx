import { useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { PageHeader } from '../components/PageHeader';
import { Reveal } from '../components/Reveal';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { WORKFLOW_STEPS } from '../data/demo';

/** Workflow page: interactive stepper + selected-step detail panel. */
export function WorkflowPage() {
    const [selectedId, setSelectedId] = useState(WORKFLOW_STEPS[2].id);
    const selected =
        WORKFLOW_STEPS.find((step) => step.id === selectedId) ?? WORKFLOW_STEPS[0];

    const completed = WORKFLOW_STEPS.filter(
        (step) => step.status === 'complete',
    ).length;

    return (
        <div>
            <PageHeader
                title={
                    <>
                        Research workflow
                        <span className="badge badge-cyan">
                            {completed}/{WORKFLOW_STEPS.length} ready
                        </span>
                    </>
                }
                subtitle="A research workflow from image capture to descriptive optical analysis. Frontend tools run locally in the browser; no laboratory or clinical validation is represented."
            />

            <Reveal>
                <GlassCard
                    glow
                    title="Pipeline stages"
                    action={
                        <span className="mono text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                            Select a stage for detail
                        </span>
                    }
                >
                    <WorkflowStepper
                        steps={WORKFLOW_STEPS}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                </GlassCard>
            </Reveal>

            <Reveal delay={0.1}>
                <div className="mt-5">
                    <GlassCard hover title={`Stage ${selected.index} — ${selected.title}`}>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span
                                    className={`badge ${
                                        selected.status === 'complete'
                                            ? 'badge-pass'
                                            : selected.status === 'active'
                                              ? 'badge-cyan'
                                              : 'badge-pending'
                                    }`}
                                >
                                    {selected.status === 'complete'
                                        ? 'Complete'
                                        : selected.status === 'active'
                                          ? 'In progress'
                                          : 'Queued'}
                                </span>
                                <span className="mono text-[12px] text-txt-muted">
                                    {selected.description}
                                </span>
                            </div>
                            <p className="max-w-[820px] text-[14px] leading-relaxed text-txt-2">
                                {selected.detail}
                            </p>
                            <div className="rounded-lg border-l-4 border-cyan border-y border-r border-line bg-[rgba(10,24,48,0.85)] px-5 py-4">
                                <p className="mb-1 text-[14px] font-bold text-white">
                                    Milestone scoping
                                </p>
                                <p className="text-[13px] leading-relaxed text-txt-2">
                                    Image capture, ROI measurement, affine optical calibration,
                                    held-out patch comparison, kinetic analysis and CSV import/export
                                    run in the browser. Sessions and derived analysis records can be
                                    saved to the local backend; original files stay browser-local.
                                    Laboratory and clinical validation remain future work.
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </Reveal>
        </div>
    );
}
