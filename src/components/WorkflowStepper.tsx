import type { WorkflowStep } from '../types';

interface WorkflowStepperProps {
    steps: WorkflowStep[];
    selectedId: string;
    onSelect: (id: string) => void;
    /** Compact variant used on the dashboard. */
    compact?: boolean;
}

const STATUS_STYLES: Record<WorkflowStep['status'], { badge: string; dot: string }> = {
    complete: { badge: 'Complete', dot: 'bg-pass' },
    active: { badge: 'In progress', dot: 'bg-cyan' },
    upcoming: { badge: 'Queued', dot: 'bg-txt-muted' },
};

/**
 * Research workflow indicator — clickable step nodes that drive the
 * selected-step detail panel (real state owned by the parent page).
 */
export function WorkflowStepper({
    steps,
    selectedId,
    onSelect,
    compact = false,
}: WorkflowStepperProps) {
    return (
        <ol className="grid gap-3 max-sm:grid-cols-1" style={{
            gridTemplateColumns: compact
                ? 'repeat(auto-fit, minmax(170px, 1fr))'
                : 'repeat(auto-fit, minmax(190px, 1fr))',
        }}>
            {steps.map((step) => {
                const active = step.id === selectedId;
                const styles = STATUS_STYLES[step.status];

                return (
                    <li key={step.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(step.id)}
                            aria-pressed={active}
                            className={[
                                'group flex h-full w-full flex-col gap-2 overflow-hidden rounded-lg border p-4 text-left transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                                active
                                    ? 'border-[rgba(0,242,254,0.5)] bg-[rgba(20,38,72,0.8)] shadow-[0_0_20px_rgba(0,242,254,0.12)]'
                                    : 'border-line bg-[rgba(14,28,54,0.6)] hover:-translate-y-0.5 hover:border-[rgba(0,242,254,0.4)] hover:bg-[rgba(20,38,72,0.8)]',
                            ].join(' ')}
                        >
                            <span className="mono flex items-center justify-between text-[11px] font-bold text-cyan">
                                <span>STEP {step.index}</span>
                                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.5px] text-txt-muted">
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                                        aria-hidden="true"
                                    />
                                    {styles.badge}
                                </span>
                            </span>
                            <span className="text-[13.5px] font-semibold text-white">
                                {step.title}
                            </span>
                            {!compact ? (
                                <span className="text-[11px] leading-snug text-txt-muted">
                                    {step.description}
                                </span>
                            ) : null}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}
