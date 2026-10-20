import type { ReactNode } from 'react';
import { usePointerGlow } from './usePointerGlow';

interface GlassCardProps {
    title?: ReactNode;
    /** Trailing controls rendered on the card header row. */
    action?: ReactNode;
    /** Enable the pointer-following cyan radial glow. */
    glow?: boolean;
    /** Enable the subtle hover lift + border transition. */
    hover?: boolean;
    className?: string;
    bodyClassName?: string;
    children: ReactNode;
}

/**
 * Glass-style card (translucent surface + backdrop blur).
 * With `glow`, the card tracks the pointer and paints a cyan radial highlight
 * (the prototype's `.glow-card` behaviour) using CSS custom properties.
 */
export function GlassCard({
    title,
    action,
    glow = false,
    hover = false,
    className = '',
    bodyClassName = '',
    children,
}: GlassCardProps) {
    const { ref, onMouseMove } = usePointerGlow<HTMLDivElement>();

    const classes = [
        'card',
        glow ? 'glow-card' : '',
        hover ? 'card-hover' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            ref={ref}
            className={classes}
            onMouseMove={glow ? onMouseMove : undefined}
        >
            {title || action ? (
                <div className="relative z-[2] mb-4 flex flex-wrap items-center justify-between gap-2.5">
                    {typeof title === 'string' ? (
                        <h3 className="flex items-center gap-2.5 text-[16px] font-semibold text-white">
                            {title}
                        </h3>
                    ) : (
                        title
                    )}
                    {action}
                </div>
            ) : null}
            <div className={`relative z-[2] ${bodyClassName}`.trim()}>{children}</div>
        </div>
    );
}
