import { DISCLAIMER } from '../data/demo';

/** Persistent research disclaimer bar shown above the header (z-100). */
export function DisclaimerBanner() {
    return (
        <div
            className="relative z-[100] flex flex-wrap items-center justify-center gap-3 border-b border-[rgba(245,158,11,0.3)] px-6 py-[9px] text-[13px] backdrop-blur-[8px]"
            style={{
                background:
                    'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.05))',
            }}
            role="note"
        >
            <span className="rounded-[4px] bg-pending px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-ink">
                {DISCLAIMER.badge}
            </span>
            <span className="text-[#cbd5e1]">{DISCLAIMER.text}</span>
        </div>
    );
}
