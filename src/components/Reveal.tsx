import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface RevealProps {
    children: ReactNode;
    /** Delay in seconds before the element animates in. */
    delay?: number;
    className?: string;
    /** Distance of the slide-in (px). */
    y?: number;
}

/**
 * Scroll-triggered fade-and-slide reveal.
 * Renders statically when the user prefers reduced motion.
 */
export function Reveal({ children, delay = 0, className, y = 20 }: RevealProps) {
    const reduceMotion = useReducedMotion();

    if (reduceMotion) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}

interface StaggerGroupProps {
    children: ReactNode;
    className?: string;
    /** Seconds between each child entrance. */
    stagger?: number;
}

/**
 * Staggered card entrance — children fade/slide in one after another.
 * Expects each child to be a motion element OR wraps plain nodes itself.
 */
export function StaggerGroup({
    children,
    className,
    stagger = 0.08,
}: StaggerGroupProps) {
    const reduceMotion = useReducedMotion();

    if (reduceMotion) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={className}
            initial="hidden"
            animate="show"
            variants={{
                hidden: {},
                show: {
                    transition: { staggerChildren: stagger },
                },
            }}
        >
            {children}
        </motion.div>
    );
}

interface StaggerItemProps {
    children: ReactNode;
    className?: string;
}

/** Child of a `StaggerGroup`; animates with the parent's stagger timing. */
export function StaggerItem({ children, className }: StaggerItemProps) {
    const reduceMotion = useReducedMotion();

    if (reduceMotion) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={className}
            variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
            }}
        >
            {children}
        </motion.div>
    );
}
