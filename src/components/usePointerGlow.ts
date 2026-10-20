import { useCallback, useRef } from 'react';
import type { MouseEvent, RefObject } from 'react';

/**
 * Pointer-following glow helper: tracks the cursor inside the element and
 * exposes `--mouse-x` / `--mouse-y` for the `.glow-card::after` highlight.
 */
export function usePointerGlow<T extends HTMLElement>(): {
    ref: RefObject<T | null>;
    onMouseMove: (event: MouseEvent<T>) => void;
} {
    const ref = useRef<T>(null);

    const onMouseMove = useCallback((event: MouseEvent<T>) => {
        const element = ref.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        element.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        element.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    }, []);

    return { ref, onMouseMove };
}
