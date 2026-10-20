import { useRef, useState } from 'react';
import { Button } from '../Button';
import {
    KINETIC_CSV_COLUMNS,
    kineticCsvTemplate,
} from '../../utils/kinetics';

interface CsvImporterProps {
    onTextLoaded: (fileName: string, text: string) => void;
    error: string | null;
}

/** CSV file picker + format documentation + downloadable template. */
export function CsvImporter({ onTextLoaded, error }: CsvImporterProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const downloadTemplate = () => {
        const blob = new Blob([kineticCsvTemplate()], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'uniast_kinetic_template.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-line bg-[rgba(14,28,54,0.5)] px-4 py-3">
                <p className="text-[13px] font-semibold text-white">Required columns</p>
                <p className="mono mt-1 text-[12px] leading-relaxed text-cyan">
                    {KINETIC_CSV_COLUMNS.join(', ')}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-txt-2">
                    <li>
                        <span className="mono text-txt">time_min</span> — elapsed time in
                        minutes (number ≥ 0).
                    </li>
                    <li>
                        <span className="mono text-txt">mean_r / mean_g / mean_b / mean_luminance</span> —
                        {' '}8-bit image-derived values in [0, 255].
                    </li>
                    <li>
                        Optional: <span className="mono text-txt">source</span> (filename or row
                        label), <span className="mono text-txt">roi</span> as{' '}
                        <span className="mono text-txt">x;y;width;height</span> in original
                        image pixels, <span className="mono text-txt">calibrated</span>{' '}
                        (true/false), <span className="mono text-txt">resampled</span>{' '}
                        (true/false) and <span className="mono text-txt">warnings</span>. UniAST
                        export comment lines are ignored on import.
                    </li>
                    <li>
                        Invalid rows are reported and skipped — never silently repaired
                        or fabricated.
                    </li>
                </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                    Choose CSV file
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                    Download CSV template
                </Button>
                {fileName ? (
                    <span className="mono text-[11.5px] text-txt-muted">{fileName}</span>
                ) : null}
            </div>

            <input
                ref={inputRef}
                type="file"
                className="sr-only"
                aria-label="Choose a kinetic measurement CSV file"
                accept=".csv,text/csv"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    setFileName(file.name);
                    void file.text().then((text) => onTextLoaded(file.name, text));
                }}
            />

            {error ? (
                <p
                    role="alert"
                    className="rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.09)] px-4 py-3 text-[13px] leading-relaxed text-[#fecaca]"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
