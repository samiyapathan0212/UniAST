import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
    label: string;
    hint?: string;
    children: ReactNode;
}

/** Label + control wrapper used by every form control. */
export function Field({ label, hint, children }: FieldProps) {
    return (
        <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between text-[13px] font-semibold text-txt-2">
                {label}
                {hint ? (
                    <span className="mono text-[11px] font-normal text-txt-muted">
                        {hint}
                    </span>
                ) : null}
            </label>
            {children}
        </div>
    );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
    error?: string;
};

/** Text input with label, optional hint and inline error message. */
export function TextField({ label, hint, error, id, ...rest }: TextFieldProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;

    return (
        <Field label={label} hint={hint}>
            <input
                id={fieldId}
                className="field-input"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                {...rest}
            />
            {error ? (
                <span
                    id={`${fieldId}-error`}
                    className="text-[12px] text-alert"
                    role="alert"
                >
                    {error}
                </span>
            ) : null}
        </Field>
    );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    hint?: string;
    options: readonly string[];
};

/** Native select with label — used for filters and dropdowns. */
export function SelectField({
    label,
    hint,
    options,
    id,
    ...rest
}: SelectFieldProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;

    return (
        <Field label={label} hint={hint}>
            <select id={fieldId} className="field-input" {...rest}>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </Field>
    );
}

interface TextAreaFieldProps
    extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    hint?: string;
}

/** Multiline text control for experiment notes. */
export function TextAreaField({ label, hint, id, ...rest }: TextAreaFieldProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;

    return (
        <Field label={label} hint={hint}>
            <textarea id={fieldId} className="field-input resize-y" {...rest} />
        </Field>
    );
}
