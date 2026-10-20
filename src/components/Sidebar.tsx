import type { ReactNode } from 'react';
import type { PageId } from '../types';

interface NavItem {
    id: PageId;
    label: string;
    icon: ReactNode;
}

interface SidebarProps {
    page: PageId;
    onNavigate: (page: PageId) => void;
    /** Mobile visibility (controlled by AppShell). */
    open: boolean;
}

const NAV_ITEMS: NavItem[] = [
    {
        id: 'landing',
        label: 'Overview',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
            </svg>
        ),
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
        ),
    },
    {
        id: 'workspace',
        label: 'Image Workspace',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
            </svg>
        ),
    },
    {
        id: 'calibration',
        label: 'Calibration',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            </svg>
        ),
    },
    {
        id: 'calibration-benchmark',
        label: 'Calibration Benchmark',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
        ),
    },
    {
        id: 'kinetics',
        label: 'Kinetic Analysis',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
    },
    {
        id: 'workflow',
        label: 'Research Workflow',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="6" r="2.5" />
                <circle cx="19" cy="18" r="2.5" />
                <path d="M7.5 6H14a4 4 0 0 1 0 8H10a4 4 0 0 0 0 8h6.5" />
            </svg>
        ),
    },
    {
        id: 'sessions',
        label: 'Saved Sessions',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16v15H4z" />
                <path d="M8 9h8M8 13h8M8 17h5" />
            </svg>
        ),
    },
];

/** Responsive primary navigation (270px sticky sidebar on desktop). */
export function Sidebar({ page, onNavigate, open }: SidebarProps) {
    return (
        <nav
            aria-label="Primary"
            className={[
                'sticky top-[72px] flex h-[calc(100vh-72px)] w-[270px] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line bg-[rgba(5,12,26,0.7)] px-4 py-6 backdrop-blur-[14px]',
                open ? 'max-lg:flex' : 'max-lg:hidden',
                'max-lg:static max-lg:h-auto max-lg:w-full max-lg:border-r-0 max-lg:border-b',
            ].join(' ')}
        >
            <span className="mono px-3.5 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-[1.2px] text-txt-muted">
                Research Console
            </span>

            {NAV_ITEMS.map((item) => {
                const active = page === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={[
                            'relative flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-[14px] font-medium transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                            active
                                ? 'border-[rgba(0,242,254,0.35)] font-semibold text-white shadow-[0_0_20px_rgba(0,242,254,0.08)]'
                                : 'border-transparent text-txt-2 hover:translate-x-[3px] hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] hover:text-txt',
                        ].join(' ')}
                        style={
                            active
                                ? {
                                      background:
                                          'linear-gradient(90deg, rgba(0,242,254,0.14), rgba(0,242,254,0.03))',
                                  }
                                : undefined
                        }
                    >
                        {active ? (
                            <span
                                aria-hidden="true"
                                className="absolute left-0 top-[20%] h-[60%] w-[3px] rounded-r-[3px] bg-cyan shadow-[0_0_8px_#00f2fe]"
                            />
                        ) : null}
                        <span
                            aria-hidden="true"
                            className={[
                                'shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px] transition-all duration-[250ms]',
                                active
                                    ? 'text-cyan drop-shadow-[0_0_6px_rgba(0,242,254,0.6)]'
                                    : 'text-txt-muted',
                            ].join(' ')}
                        >
                            {item.icon}
                        </span>
                        {item.label}
                    </button>
                );
            })}

            <div className="mx-2 my-3.5 h-px bg-line" />

            <div className="mono mt-auto rounded-lg border border-line bg-black/25 px-3 py-4 text-[11px] text-txt-muted">
                <span className="mb-0.5 block font-semibold text-cyan">
                    Milestone 4 — Kinetic Analysis
                </span>
                Time-series optical measurements with ROI selection, kinetic
                chart, and CSV export are now live.
            </div>
        </nav>
    );
}
