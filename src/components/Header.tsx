import { STATUS_PILL } from '../data/demo';

interface HeaderProps {
    /** Toggles the mobile sidebar. */
    onToggleMenu: () => void;
    menuOpen: boolean;
}

/** Sticky application header with UniAST branding and demo status pill. */
export function Header({ onToggleMenu, menuOpen }: HeaderProps) {
    return (
        <header className="sticky top-0 z-[90] flex h-[72px] items-center justify-between border-b border-line bg-[rgba(5,12,26,0.85)] px-8 backdrop-blur-[16px] max-md:px-[18px]">
            <div className="flex items-center gap-3.5">
                <div
                    aria-hidden="true"
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line-accent text-cyan shadow-[0_0_16px_rgba(0,242,254,0.2)]"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(0,242,254,0.25), rgba(168,85,247,0.25))',
                    }}
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M3 13h4l3-8 4 16 3-8h4" />
                    </svg>
                </div>
                <div className="flex flex-col leading-tight">
                    <span className="text-[22px] font-extrabold tracking-[-0.5px] text-white max-md:text-[19px]">
                        Uni<span className="text-cyan drop-shadow-[0_0_12px_rgba(0,242,254,0.6)]">AST</span>
                    </span>
                    <span className="mono text-[11px] uppercase tracking-[0.8px] text-txt-muted max-md:hidden">
                        Universal Smartphone AST
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-2 rounded-[30px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] px-3.5 py-1.5 text-[12px] font-medium text-[#fde68a] max-sm:hidden">
                    <span className="status-dot" aria-hidden="true" />
                    {STATUS_PILL}
                </span>
                <button
                    type="button"
                    onClick={onToggleMenu}
                    aria-expanded={menuOpen}
                    aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    className="hidden rounded-lg border border-line bg-[rgba(255,255,255,0.05)] px-3 py-2 text-white max-lg:block"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                    >
                        {menuOpen ? (
                            <path d="M6 6l12 12M18 6 6 18" />
                        ) : (
                            <path d="M4 7h16M4 12h16M4 17h16" />
                        )}
                    </svg>
                </button>
            </div>
        </header>
    );
}
