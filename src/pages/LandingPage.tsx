import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { Reveal, StaggerGroup, StaggerItem } from '../components/Reveal';
import { SignalIllustration } from '../components/SignalIllustration';
import type { PageId } from '../types';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const HIGHLIGHTS = [
    {
        title: 'Traceable calibration',
        description: 'Every correction matrix records its source measurements.',
    },
    {
        title: 'Device-portable capture',
        description: 'Designed to explore capture across OLED and LCD panels; cross-device performance is unvalidated.',
    },
    {
        title: 'Honest reporting',
        description: 'Simulated dashboard data stays separate from locally saved research records.',
    },
    {
        title: 'Kinetic signal analysis',
        description: 'Temporal response curves with reference overlays.',
    },
];

interface LandingPageProps {
    onNavigate: (page: PageId) => void;
}

/** Landing / welcome experience with animated hero and working CTAs. */
export function LandingPage({ onNavigate }: LandingPageProps) {
    const reduceMotion = useReducedMotion();
    const words = ['Universal', 'Smartphone', 'AST'];

    return (
        <div>
            <section
                className="relative mb-8 overflow-hidden rounded-lg border border-line-accent px-12 py-12 shadow-[0_0_50px_rgba(0,242,254,0.08)] max-md:px-6 max-md:py-8"
                style={{
                    background:
                        'linear-gradient(135deg, rgba(10,24,50,0.8), rgba(6,12,26,0.95))',
                }}
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-[100px] -top-[120px] h-[450px] w-[450px] rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(0,242,254,0.15) 0%, rgba(168,85,247,0.05) 50%, transparent 70%)',
                    }}
                />

                <div className="relative z-[2]">
                    <span className="mono mb-5 inline-flex items-center gap-2 rounded-[20px] border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.1)] px-3.5 py-1.5 text-[12px] font-semibold text-cyan">
                        <span className="status-dot" aria-hidden="true" />
                        Research prototype — browser analysis and local persistence
                    </span>

                    <h1 className="mb-4 text-[40px] font-extrabold leading-[1.18] tracking-[-1px] text-white max-md:text-[30px]">
                        {words.map((word, index) => (
                            <motion.span
                                key={word}
                                className={
                                    index === words.length - 1
                                        ? 'gradient-text mr-2 inline-block'
                                        : 'mr-2 inline-block'
                                }
                                initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.6,
                                    ease: EASE,
                                    delay: 0.1 + index * 0.14,
                                }}
                            >
                                {word}
                            </motion.span>
                        ))}
                    </h1>

                    <motion.p
                        className="mb-7 max-w-[800px] text-[15.5px] leading-relaxed text-txt-2"
                        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
                    >
                        UniAST measures how smartphone displays render colour and light,
                        then derives a kinetic response signal from a single calibrated
                        capture. This React build ships the foundation: landing,
                        navigation, design system and a demo dashboard.
                    </motion.p>

                    <motion.div
                        className="flex flex-wrap gap-4"
                        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: EASE, delay: 0.65 }}
                    >
                        <Button variant="primary" onClick={() => onNavigate('dashboard')}>
                            Open dashboard
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                aria-hidden="true"
                            >
                                <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                        </Button>
                        <Button variant="secondary" onClick={() => onNavigate('workflow')}>
                            Explore the workflow
                        </Button>
                    </motion.div>

                    <div className="mt-9 grid gap-4 border-t border-line pt-7 max-sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {HIGHLIGHTS.map((highlight, index) => (
                            <Reveal key={highlight.title} delay={index * 0.08}>
                                <div className="flex flex-col gap-1">
                                    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
                                        <span
                                            className="h-1.5 w-1.5 rounded-full bg-cyan"
                                            aria-hidden="true"
                                        />
                                        {highlight.title}
                                    </span>
                                    <span className="text-[12px] leading-snug text-txt-muted">
                                        {highlight.description}
                                    </span>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <StaggerGroup className="grid gap-5 lg:grid-cols-3">
                <StaggerItem className="lg:col-span-2">
                    <GlassCard
                        glow
                        hover
                        title="Scientific signal preview"
                        action={<span className="badge badge-cyan">SIMULATED</span>}
                    >
                        <SignalIllustration />
                    </GlassCard>
                </StaggerItem>

                <StaggerItem className="h-full">
                    <GlassCard
                        glow
                        hover
                        title="Research workflow"
                        className="h-full"
                        action={
                            <button
                                type="button"
                                onClick={() => onNavigate('workflow')}
                                className="mono text-[11.5px] font-semibold text-cyan underline-offset-4 hover:underline"
                            >
                                View all
                            </button>
                        }
                    >
                        <ol className="flex flex-col gap-3">
                            {[
                                'Image capture',
                                'ROI selection',
                                'Optical calibration',
                                'Signal extraction',
                                'Analysis report',
                            ].map((step, index) => (
                                <li
                                    key={step}
                                    className="flex items-center gap-3 rounded-lg border border-line bg-[rgba(14,28,54,0.6)] px-3.5 py-2.5"
                                >
                                    <span className="mono text-[11px] font-bold text-cyan">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="text-[13px] text-txt">{step}</span>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-4">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onNavigate('workflow')}
                            >
                                Open workflow detail
                            </Button>
                        </div>
                    </GlassCard>
                </StaggerItem>
            </StaggerGroup>
        </div>
    );
}
