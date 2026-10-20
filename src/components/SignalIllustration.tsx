import { motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Smooth waveform path rendered inside the hero. */
const WAVE_PATH =
    'M0 70 C 30 70, 34 30, 58 30 S 86 92, 112 92 S 142 22, 170 22 S 198 78, 226 78 S 256 44, 284 44 S 312 70, 340 70';

const REFERENCE_PATH = 'M0 70 C 70 66, 140 64, 210 62 S 300 58, 340 56';

/**
 * Scientific signal illustration: an animated kinetic waveform over a faint
 * measurement grid, with drifting scan nodes. Static under reduced motion.
 */
export function SignalIllustration() {
    const reduceMotion = useReducedMotion();

    return (
        <div className="relative overflow-hidden rounded-lg border border-line bg-[rgba(5,12,26,0.6)] p-4 backdrop-blur-[10px]">
            <div className="mono mb-3 flex items-center justify-between text-[10.5px] uppercase tracking-[1px] text-txt-muted">
                <span>Kinetic trace — simulated</span>
                <span className="text-cyan">ROI 42 × 42 px</span>
            </div>

            <svg
                viewBox="0 0 340 140"
                className="h-auto w-full"
                role="img"
                aria-label="Animated illustration of a kinetic signal waveform over a reference baseline"
            >
                <defs>
                    <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#00f2fe" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#00f2fe" />
                        <stop offset="70%" stopColor="#00c2cb" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>

                {/* measurement grid */}
                <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <line key={`h${i}`} x1="0" y1={i * 24 + 8} x2="340" y2={i * 24 + 8} />
                    ))}
                    {Array.from({ length: 9 }).map((_, i) => (
                        <line key={`v${i}`} x1={i * 42 + 8} y1="0" x2={i * 42 + 8} y2="140" />
                    ))}
                </g>

                {/* reference baseline */}
                <path
                    d={REFERENCE_PATH}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                    opacity="0.8"
                />

                {/* filled area under the waveform */}
                <motion.path
                    d={`${WAVE_PATH} L340 140 L0 140 Z`}
                    fill="url(#waveFill)"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5, ease: EASE }}
                />

                {/* animated waveform */}
                <motion.path
                    d={WAVE_PATH}
                    fill="none"
                    stroke="url(#waveStroke)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                    animate={
                        reduceMotion
                            ? { pathLength: 1 }
                            : { pathLength: [0, 1, 1, 0] }
                    }
                    transition={
                        reduceMotion
                            ? undefined
                            : {
                                  duration: 4.5,
                                  times: [0, 0.45, 0.8, 1],
                                  ease: 'easeInOut',
                                  repeat: Infinity,
                                  repeatDelay: 0.4,
                              }
                    }
                />

                {/* scan node */}
                <motion.circle
                    r="4"
                    fill="#00f2fe"
                    initial={reduceMotion ? false : { cx: 0, cy: 70 }}
                    animate={
                        reduceMotion
                            ? { cx: 340, cy: 56 }
                            : { cx: [0, 340], cy: [70, 56] }
                    }
                    transition={
                        reduceMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: 'linear' }
                    }
                />
            </svg>

            <div className="mono mt-3 grid grid-cols-3 gap-3 text-[11px] text-txt-muted">
                <span>
                    Peak <span className="text-cyan">64.2</span>
                </span>
                <span>
                    Noise floor <span className="text-cyan">2.1</span>
                </span>
                <span>
                    SNR <span className="text-cyan">38.6 dB</span>
                </span>
            </div>
        </div>
    );
}
