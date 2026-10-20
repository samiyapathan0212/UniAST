import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: string;
    children?: ReactNode;
}

/** Consistent page title / subtitle row with optional trailing actions. */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-3 text-[28px] font-bold tracking-[-0.5px] text-white">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="mt-1.5 max-w-[780px] text-[14.5px] text-txt-2">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            {children ? <div className="flex flex-wrap gap-4">{children}</div> : null}
        </div>
    );
}
