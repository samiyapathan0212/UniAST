import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import { SelectField, TextAreaField, TextField } from './FormControls';
import { DEVICE_OPTIONS } from '../data/demo';
import type { NewExperimentInput } from '../types';

interface NewExperimentModalProps {
    open: boolean;
    onClose: () => void;
    onCreate: (input: NewExperimentInput) => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * New Experiment dialog — real form state, validates the name, submits into
 * the dashboard's experiment list (simulated, Milestone 1).
 */
export function NewExperimentModal({
    open,
    onClose,
    onCreate,
}: NewExperimentModalProps) {
    const reduceMotion = useReducedMotion();
    const [name, setName] = useState('');
    const [device, setDevice] = useState<string>(DEVICE_OPTIONS[0]);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const reset = () => {
        setName('');
        setDevice(DEVICE_OPTIONS[0]);
        setNotes('');
        setError('');
    };

    const handleSubmit = () => {
        if (name.trim().length < 3) {
            setError('Give the experiment a descriptive name (3+ characters).');
            return;
        }
        onCreate({ name: name.trim(), device, notes: notes.trim() });
        reset();
    };

    const handleCancel = () => {
        reset();
        onClose();
    };

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <button
                        type="button"
                        aria-label="Close dialog"
                        onClick={handleCancel}
                        className="absolute inset-0 h-full w-full cursor-default bg-[rgba(2,5,11,0.75)] backdrop-blur-[3px]"
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="new-experiment-title"
                        className="card glow-card relative z-[2] w-full max-w-[520px]"
                        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                            reduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, y: 16, scale: 0.98 }
                        }
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        <div className="relative z-[2] mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2
                                    id="new-experiment-title"
                                    className="text-[18px] font-bold text-white"
                                >
                                    New experiment
                                </h2>
                                <p className="mt-1 text-[13px] text-txt-2">
                                    Added to the dashboard as simulated demo data only; this does
                                    not create or save a research session.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancel}
                                aria-label="Close"
                                className="rounded-lg border border-line px-2.5 py-1.5 text-txt-2 transition-colors hover:border-[rgba(0,242,254,0.4)] hover:text-white"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    aria-hidden="true"
                                >
                                    <path d="M6 6l12 12M18 6 6 18" />
                                </svg>
                            </button>
                        </div>
                        <form
                            className="relative z-[2] flex flex-col gap-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                handleSubmit();
                            }}
                        >
                            <TextField
                                label="Experiment name"
                                hint="required"
                                placeholder="e.g. OLED drift sweep — Pixel 8"
                                value={name}
                                error={error}
                                autoFocus
                                onChange={(event) => {
                                    setName(event.target.value);
                                    if (error) setError('');
                                }}
                            />
                            <SelectField
                                label="Target device"
                                options={DEVICE_OPTIONS}
                                value={device}
                                onChange={(event) => setDevice(event.target.value)}
                            />
                            <TextAreaField
                                label="Notes"
                                hint="optional"
                                rows={3}
                                placeholder="Conditions, panel batch, ambient light…"
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                            />

                            <div className="mt-1 flex flex-wrap justify-end gap-3">
                                <Button variant="secondary" onClick={handleCancel}>
                                    Cancel
                                </Button>
                                <Button variant="primary" type="submit">
                                    Create experiment
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
