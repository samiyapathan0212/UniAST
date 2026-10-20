import type { ReactNode } from 'react';
import type { BadgeTone } from '../types';

interface BadgeProps {
    tone?: BadgeTone;
    children: ReactNode;
    className?: string;
}

/** Status badge — tones map to pass / pending / alert / cyan in the design system. */
export function Badge({ tone = 'cyan', children, className = '' }: BadgeProps) {
    return (
        <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>
    );
}

/** "SIMULATED DEMO DATA" marker used on every fabricated figure. */
export function DemoTag({ label = 'SIMULATED' }: { label?: string }) {
    return <span className="badge-demo">{label}</span>;
}
