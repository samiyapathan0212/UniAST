/**
 * Kinetic analysis of image-derived optical measurements — pure, deterministic
 * TypeScript with no DOM/React imports (runs under the Node test runner).
 *
 * Descriptive statistics only. These functions never infer bacterial identity,
 * bacterial growth, antimicrobial susceptibility, resistance, or any clinical
 * endpoint: a slope here is a *rate of optical change*, not a growth rate.
 */

export type CalibrationChoice = 'raw' | 'calibrated';
export const KINETIC_METHOD_VERSION = 'optical-series-v1';

/** One validated observation in a kinetic time series. */
export interface KineticObservation {
    /** Elapsed time in minutes (≥ 0, finite). */
    timeMin: number;
    /** Source filename (image path) or CSV row identifier, e.g. "row 4". */
    source: string;
    meanR: number;
    meanG: number;
    meanB: number;
    /** Mean Rec.709 luminance, 0–255 scale. */
    meanLuminance: number;
    /** ROI in ORIGINAL image pixels, or null when metadata unavailable. */
    roi: { x: number; y: number; width: number; height: number } | null;
    /** True when pixel sampling stayed in budget via resampling. */
    resampled: boolean;
    /** Set explicitly by the user, never assumed. */
    calibrated: boolean;
    /** Non-blocking quality notes, e.g. dimension warnings. */
    warnings: string[];
}

/** One row after derivation (baseline/rate columns for table + export). */
export interface DerivedObservation extends KineticObservation {
    /** Absolute change of mean luminance from the baseline observation. */
    deltaFromBaseline: number;
    /** Change per minute since previous obs; null for baseline/zero gap. */
    ratePerMinute: number | null;
    /** Relative change; null when baseline is zero (shown as unavailable). */
    normalizedChange: number | null;
}

export interface SeriesIssue {
    kind: 'duplicate-time' | 'invalid-value' | 'missing-point' | 'dimension-mismatch' | 'unvalidated';
    message: string;
}

export interface ValidatedSeries {
    /** Observations sorted by elapsed time (stable for equal times). */
    observations: DerivedObservation[];
    issues: SeriesIssue[];
    baselineLuminance: number | null;
}

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

function validChannel(value: unknown): boolean {
    return isFiniteNumber(value) && value >= 0 && value <= 255;
}

function warningsOf(input: { warnings?: unknown }): string[] {
    return Array.isArray(input.warnings)
        ? input.warnings.filter((w): w is string => typeof w === 'string')
        : [];
}

export type RawKineticRow = {
    timeMin: unknown;
    source?: unknown;
    meanR: unknown;
    meanG: unknown;
    meanB: unknown;
    meanLuminance: unknown;
    roi?: { x: number; y: number; width: number; height: number } | null;
    resampled?: unknown;
    calibrated?: unknown;
    warnings?: unknown;
};

/**
 * Sort observations by elapsed time (stable) and derive baseline/rate
 * columns. Invalid rows are *reported* in `issues` and excluded — never
 * silently repaired or fabricated.
 */
export function validateAndDeriveSeries(raw: ReadonlyArray<RawKineticRow>): ValidatedSeries {
    const issues: SeriesIssue[] = [];
    const seenTimes = new Map<number, number>();
    const kept: KineticObservation[] = [];

    raw.forEach((row, index) => {
        const rowId =
            typeof row.source === 'string' && row.source.length > 0
                ? `"${row.source}"`
                : `row ${index + 1}`;
        if (!isFiniteNumber(row.timeMin) || row.timeMin < 0) {
            issues.push({
                kind: 'invalid-value',
                message: `${rowId}: elapsed time must be a finite number ≥ 0 min.`,
            });
            return;
        }
        const channels: Array<[string, unknown]> = [
            ['mean_r', row.meanR],
            ['mean_g', row.meanG],
            ['mean_b', row.meanB],
            ['mean_luminance', row.meanLuminance],
        ];
        const bad = channels.filter(([, v]) => !validChannel(v)).map(([n]) => n);
        if (bad.length > 0) {
            issues.push({
                kind: 'invalid-value',
                message: `${rowId}: invalid value(s) in ${bad.join(', ')} — must be finite numbers in [0, 255].`,
            });
            return;
        }
        let rowWarnings = warningsOf(row);
        if (seenTimes.has(row.timeMin)) {
            const duplicateMessage = `${rowId}: duplicate elapsed time ${row.timeMin} min (first seen at row ${seenTimes.get(row.timeMin)}). Both rows are kept in time order, but per-minute rates adjacent to a duplicate are unavailable.`;
            issues.push({
                kind: 'duplicate-time',
                message: duplicateMessage,
            });
            rowWarnings = [...rowWarnings, duplicateMessage];
        } else {
            seenTimes.set(row.timeMin, index + 1);
        }
        kept.push({
            timeMin: row.timeMin,
            source: typeof row.source === 'string' ? row.source : `row ${index + 1}`,
            meanR: row.meanR as number,
            meanG: row.meanG as number,
            meanB: row.meanB as number,
            meanLuminance: row.meanLuminance as number,
            roi: row.roi ?? null,
            resampled: row.resampled === true,
            calibrated: row.calibrated === true,
            warnings: rowWarnings,
        });
    });

    const indexed = kept.map((obs, order) => ({ obs, order }));
    indexed.sort((a, b) => a.obs.timeMin - b.obs.timeMin || a.order - b.order);
    const sorted = indexed.map((entry) => entry.obs);
    const baseline = sorted.length > 0 ? sorted[0].meanLuminance : null;

    const observations: DerivedObservation[] = sorted.map((obs, i) => {
        const previous = i > 0 ? sorted[i - 1] : null;
        const gap = previous ? obs.timeMin - previous.timeMin : 0;
        return {
            ...obs,
            deltaFromBaseline: baseline === null ? 0 : obs.meanLuminance - baseline,
            ratePerMinute:
                previous && gap > 0 ? (obs.meanLuminance - previous.meanLuminance) / gap : null,
            normalizedChange:
                baseline !== null && baseline !== 0
                    ? (obs.meanLuminance - baseline) / baseline
                    : null,
        };
    });

    return { observations, issues, baselineLuminance: baseline };
}
/** Absolute change of each luminance value from the first (baseline). */
export function baselineChanges(values: readonly number[]): number[] {
    if (values.length === 0) return [];
    const baseline = values[0];
    return values.map((value) => value - baseline);
}

/** Change per minute between adjacent observations (null: first/zero gap). */
export function ratesPerMinute(
    times: readonly number[],
    values: readonly number[],
): Array<number | null> {
    return values.map((value, i) => {
        if (i === 0) return null;
        const gap = times[i] - times[i - 1];
        if (!Number.isFinite(gap) || gap <= 0) return null;
        return (value - values[i - 1]) / gap;
    });
}

/** Change relative to baseline; null when baseline is zero/non-finite. */
export function normalizedChanges(values: readonly number[]): Array<number | null> {
    if (values.length === 0) return [];
    const baseline = values[0];
    if (!Number.isFinite(baseline) || baseline === 0) return values.map(() => null);
    return values.map((value) => (value - baseline) / baseline);
}

export interface RoiSize {
    width: number;
    height: number;
}

/**
 * Check every frame against the reference frame dimensions. Returns the
 * labels of mismatching frames — the caller must surface these and require
 * an explicit user decision. Never silently misaligns ROIs.
 */
export function findDimensionMismatches(
    reference: RoiSize,
    frames: ReadonlyArray<{ label: string; width: number; height: number }>,
): string[] {
    return frames
        .filter((frame) => frame.width !== reference.width || frame.height !== reference.height)
        .map((frame) => `${frame.label} (${frame.width}x${frame.height}px)`);
}
export const KINETIC_CSV_COLUMNS = [
    'time_min',
    'mean_r',
    'mean_g',
    'mean_b',
    'mean_luminance',
] as const;

export const KINETIC_CSV_OPTIONAL_COLUMNS = [
    'source', 'roi', 'calibrated', 'resampled', 'warnings',
] as const;

export interface CsvParseRow {
    timeMin: unknown;
    source: string;
    meanR: unknown;
    meanG: unknown;
    meanB: unknown;
    meanLuminance: unknown;
    roi: { x: number; y: number; width: number; height: number } | null;
    calibrated: boolean;
    resampled: boolean;
    warnings: string[];
}

export interface CsvParseResult {
    rows: CsvParseRow[];
    errors: string[];
    warnings: string[];
}

function splitCsvLine(line: string): string[] | null {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteClosed = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                    quoteClosed = true;
                }
            } else {
                current += char;
            }
        } else if (char === '"') {
            if (current.trim() !== '' || quoteClosed) return null;
            current = '';
            inQuotes = true;
        } else if (char === ',') {
            fields.push(current);
            current = '';
            quoteClosed = false;
        } else if (quoteClosed) {
            if (!/\s/.test(char)) return null;
        } else {
            current += char;
        }
    }
    if (inQuotes) return null;
    fields.push(current);
    return fields.map((field) => field.trim());
}

function parseRoiCell(cell: string): CsvParseRow['roi'] {
    if (cell === '') return null;
    const parts = cell.split(';').map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    const [x, y, width, height] = parts;
    if (width < 1 || height < 1) return null;
    return { x, y, width, height };
}

/**
 * Parse a measurement CSV. Required columns: time_min, mean_r, mean_g,
 * mean_b, mean_luminance (minutes + 8-bit 0–255). Optional: source, roi
 * ("x;y;width;height"), calibrated ("true"/"false"). Invalid rows are
 * reported and skipped — never repaired or fabricated.
 */
export function parseKineticCsv(text: string): CsvParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rows: CsvParseRow[] = [];

    if (text.trim() === '') {
        return { rows, errors: ['The file is empty.'], warnings };
    }

    const lines = text
        .split(/\r?\n/)
        .map((line, index) => ({ line, rowNumber: index + 1 }))
        .filter(({ line }) => line.trim() !== '');
    const headerIndex = lines.findIndex(({ line }) => !line.trimStart().startsWith('#'));
    if (headerIndex < 0) return { rows, errors: ['No CSV header found.'], warnings };
    const parsedHeader = splitCsvLine(lines[headerIndex].line);
    if (!parsedHeader) return { rows, errors: ['Malformed CSV quoting in header.'], warnings };
    const header = parsedHeader.map((h) => h.replace(/^\uFEFF/, '').toLowerCase());
    const missing = KINETIC_CSV_COLUMNS.filter((col) => !header.includes(col));
    if (missing.length > 0) {
        return {
            rows,
            errors: [
                `Missing required column(s): ${missing.join(', ')}. Required: ${KINETIC_CSV_COLUMNS.join(', ')}.`,
            ],
            warnings,
        };
    }
    const indexOf = (col: string) => header.indexOf(col);
    const hasRoi = header.includes('roi');
    const hasSource = header.includes('source');
    const hasCal = header.includes('calibrated');
    const hasResampled = header.includes('resampled');
    const hasWarnings = header.includes('warnings');
    if (!hasRoi) {
        warnings.push('No roi column — ROI metadata will be marked unavailable for all rows.');
    }

    lines.slice(headerIndex + 1).forEach(({ line, rowNumber }) => {
        if (line.trimStart().startsWith('#')) return;
        const cells = splitCsvLine(line);
        if (!cells) {
            errors.push(`Row ${rowNumber}: malformed CSV quoting — row skipped.`);
            return;
        }
        const numeric = (col: string): number => {
            const cell = cells[indexOf(col)] ?? '';
            return cell.trim() === '' ? Number.NaN : Number(cell);
        };
        const timeMin = numeric('time_min');
        const meanR = numeric('mean_r');
        const meanG = numeric('mean_g');
        const meanB = numeric('mean_b');
        const meanLuminance = numeric('mean_luminance');
        const pairs: Array<[string, number, boolean]> = [
            ['time_min', timeMin, Number.isFinite(timeMin) && timeMin >= 0],
            ['mean_r', meanR, Number.isFinite(meanR) && meanR >= 0 && meanR <= 255],
            ['mean_g', meanG, Number.isFinite(meanG) && meanG >= 0 && meanG <= 255],
            ['mean_b', meanB, Number.isFinite(meanB) && meanB >= 0 && meanB <= 255],
            ['mean_luminance', meanLuminance, Number.isFinite(meanLuminance) && meanLuminance >= 0 && meanLuminance <= 255],
        ];
        const bad = pairs.filter(([, , ok]) => !ok).map(([n]) => n);
        if (bad.length > 0) {
            errors.push(`Row ${rowNumber}: invalid value(s) in ${bad.join(', ')} — row skipped.`);
            return;
        }
        const expectedLuminance = 0.2126 * meanR + 0.7152 * meanG + 0.0722 * meanB;
        if (Math.abs(meanLuminance - expectedLuminance) > 0.15) {
            errors.push(`Row ${rowNumber}: mean_luminance does not match the Rec.709 value calculated from mean_r, mean_g and mean_b — row skipped.`);
            return;
        }
        let roi: CsvParseRow['roi'] = null;
        if (hasRoi) {
            const cell = cells[indexOf('roi')] ?? '';
            const parsed = parseRoiCell(cell);
            if (cell !== '' && !parsed) {
                warnings.push(
                    `Row ${rowNumber}: unrecognised roi "${cell}" (expected "x;y;width;height") — ROI metadata marked unavailable for this row.`,
                );
            }
            roi = parsed;
        }
        const sourceCell = hasSource ? (cells[indexOf('source')] ?? '') : '';
        rows.push({
            timeMin,
            source: sourceCell !== '' ? sourceCell : `row ${rowNumber}`,
            meanR,
            meanG,
            meanB,
            meanLuminance,
            roi,
            calibrated: hasCal && (cells[indexOf('calibrated')] ?? '').toLowerCase() === 'true',
            resampled: hasResampled && (cells[indexOf('resampled')] ?? '').toLowerCase() === 'true',
            warnings: hasWarnings && (cells[indexOf('warnings')] ?? '') !== ''
                ? [cells[indexOf('warnings')] ?? '']
                : [],
        });
    });

    if (rows.length === 0 && errors.length === 0) {
        errors.push('No data rows found.');
    }
    return { rows, errors, warnings };
}

/** Starter template for the CSV import (downloadable in the UI). */
export function kineticCsvTemplate(): string {
    return [
        'time_min,mean_r,mean_g,mean_b,mean_luminance,source,roi,calibrated',
        '0,132.4,128.1,121.7,128.6,frame_000.png,40;30;200;160,false',
        '30,131.0,126.4,120.2,126.9,frame_030.png,40;30;200;160,false',
        '60,129.8,124.9,119.0,125.5,frame_060.png,40;30;200;160,false',
    ].join('\n');
}
function escapeCsvField(value: string | number | boolean | null): string {
    if (value === null) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Export validated observations + derived metrics to CSV. Methodology note
 * and units are embedded as leading `#` comment lines. Only validated
 * values are exported — nothing invented or substituted.
 */
export function exportKineticsCsv(series: ValidatedSeries, calibrated: boolean): string {
    const lines: string[] = [
        '# UniAST kinetic analysis export — image-derived optical measurements (research prototype, not a diagnostic tool).',
        '# Units: time_min (minutes); rgb/luminance (8-bit 0-255); delta (luminance units); rate (luminance units per minute); normalized (fraction of baseline, empty when baseline is zero).',
        '# Method: per-row mean RGB/luminance from ROI pixels (Rec.709 Y = 0.2126R + 0.7152G + 0.0722B); delta = luminance minus baseline; rate = adjacent difference / time gap.',
        [
            'time_min',
            'source',
            'mean_r',
            'mean_g',
            'mean_b',
            'mean_luminance',
            'delta_from_baseline',
            'rate_per_min',
            'normalized_change',
            'roi',
            'resampled',
            'calibrated',
            'warnings',
        ].join(','),
    ];
    for (const obs of series.observations) {
        lines.push(
            [
                obs.timeMin,
                escapeCsvField(obs.source),
                obs.meanR.toFixed(2),
                obs.meanG.toFixed(2),
                obs.meanB.toFixed(2),
                obs.meanLuminance.toFixed(2),
                obs.deltaFromBaseline.toFixed(3),
                obs.ratePerMinute === null ? '' : obs.ratePerMinute.toFixed(4),
                obs.normalizedChange === null ? '' : obs.normalizedChange.toFixed(5),
                obs.roi ? `${obs.roi.x};${obs.roi.y};${obs.roi.width};${obs.roi.height}` : '',
                obs.resampled,
                calibrated && obs.calibrated,
                escapeCsvField(obs.warnings.join(' | ')),
            ].join(','),
        );
    }
    return `${lines.join('\n')}\n`;
}

export interface KineticSummary {
    count: number;
    timeSpanMin: number;
    baselineLuminance: number | null;
    finalLuminance: number | null;
    absoluteChange: number | null;
    meanRatePerMinute: number | null;
}

/** Descriptive summary of a validated series (no biological interpretation). */
export function summarizeSeries(series: ValidatedSeries): KineticSummary {
    const { observations } = series;
    if (observations.length === 0) {
        return {
            count: 0,
            timeSpanMin: 0,
            baselineLuminance: null,
            finalLuminance: null,
            absoluteChange: null,
            meanRatePerMinute: null,
        };
    }
    const first = observations[0];
    const last = observations[observations.length - 1];
    const rates = observations
        .map((obs) => obs.ratePerMinute)
        .filter((rate): rate is number => rate !== null);
    return {
        count: observations.length,
        timeSpanMin: last.timeMin - first.timeMin,
        baselineLuminance: first.meanLuminance,
        finalLuminance: last.meanLuminance,
        absoluteChange: last.meanLuminance - first.meanLuminance,
        meanRatePerMinute: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    };
}
