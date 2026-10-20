/**
 * CSV import: file picker + template download, column documentation,
 * error/warning reporting. Invalid rows are reported and skipped.
 */
import { useRef } from 'react';
import { Button } from '../Button';
import {
    KINETIC_CSV_COLUMNS,
    KINETIC_CSV_OPTIONAL_COLUMNS,
    kineticCsvTemplate,
} from '../../utils/kinetics';

interface CsvInputProps {
    fileName: string | null;
    errors: string[];
    warnings: string[];
    rowCount: number;
    onFileText: (fileName: string, text: string) => void;
    onClear: () => void;
    busy: boolean;
}

export function CsvInput({ fileName, errors, warnings, rowCount, onFileText, onClear, busy }: CsvInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = () => {
        const blob = new Blob([kineticCsvTemplate()], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'uniast_kinetic_template.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    const readFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => onFileText(file.name, String(reader.result ?? ''));
        reader.onerror = () => onFileText(file.name, '');
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-[rgba(14,28,54,0.5)] px-4 py-3 text-[13px] leading-relaxed text-txt-2">
                <p className="mono mb-2 text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                    Required columns · all values finite numbers
                </p>
                <p className="mono text-[12px] text-cyan">{KINETIC_CSV_COLUMNS.join(', ')}</p>
                <p className="mono mt-2 text-[11px] uppercase tracking-[0.6px] text-txt-muted">
                    Optional columns
                </p>
                <p className="mono text-[12px] text-txt-2">
                    {KINETIC_CSV_OPTIONAL_COLUMNS.join(', ')}
                </p>
                <p className="mt-2 text-txt-muted">
                    Units: time_min in minutes; mean_r/g/b/luminance on the 8-bit 0–255
                    scale. roi format: <span className="mono">x;y;width;height</span> in
                    original-image pixels. Rows with invalid values are reported and
                    skipped — never repaired or fabricated.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                    Import CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                    Download template
                </Button>
                {fileName ? (
                    <Button variant="danger" size="sm" disabled={busy} onClick={onClear}>
                        Clear CSV
                    </Button>
                ) : null}
                <span className="mono text-[11px] text-txt-muted">
                    {fileName ? `${fileName} · ${rowCount} valid row(s)` : 'no CSV loaded'}
                </span>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Import kinetic measurement CSV"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readFile(file);
                    event.target.value = '';
                }}
            />

            {errors.map((error) => (
                <p
                    key={error}
                    role="alert"
                    className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-2.5 text-[12.5px] leading-relaxed text-[#fecaca]"
                >
                    {error}
                </p>
            ))}
            {warnings.map((warning) => (
                <p
                    key={warning}
                    className="rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-2.5 text-[12.5px] leading-relaxed text-[#fde68a]"
                >
                    {warning}
                </p>
            ))}
        </div>
    );
}
