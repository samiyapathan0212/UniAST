interface LoadingStateProps {
    /** Which skeleton shape to render. */
    variant?: 'metric' | 'chart' | 'list';
    count?: number;
    label?: string;
}

const HEIGHTS: Record<NonNullable<LoadingStateProps['variant']>, string> = {
    metric: 'h-[145px]',
    chart: 'h-[320px]',
    list: 'h-[64px]',
};

/** Skeleton loading placeholder used while demo data "loads". */
export function LoadingState({
    variant = 'metric',
    count = 1,
    label = 'Loading simulated data…',
}: LoadingStateProps) {
    return (
        <div
            className="grid w-full gap-5"
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`skeleton ${HEIGHTS[variant]}`}
                    aria-hidden="true"
                />
            ))}
            <span className="sr-only">{label}</span>
        </div>
    );
}
