import type { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}

/** Friendly placeholder when a filtered list or dataset has nothing to show. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-line-accent bg-[rgba(0,242,254,0.06)] text-cyan"
            >
                {icon ?? (
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <path d="M3 12h4l3-8 4 16 3-8h4" />
                    </svg>
                )}
            </div>
            <p className="text-[15px] font-semibold text-white">{title}</p>
            <p className="max-w-[420px] text-[13px] leading-relaxed text-txt-muted">
                {description}
            </p>
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}
