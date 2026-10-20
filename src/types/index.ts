/** Shared UniAST types — Milestone 1 (frontend foundation only). */

export type PageId = 'landing' | 'dashboard' | 'workspace' | 'calibration' | 'calibration-benchmark' | 'kinetics' | 'workflow' | 'sessions';

/** A measured reference patch on the calibration page (original-image pixels). */
export interface CalibrationPatch {
    id: string;
    rect: RoiRect;
    /** Image-derived statistics measured inside the patch. */
    measured: RoiStatistics;
    /** User-supplied known values; null until entered. */
    reference: {
        r: number | null;
        g: number | null;
        b: number | null;
    };
    /** What physical reference/standard these values represent (required). */
    standard: string;
    /** 'fit' patches train the model; 'validation' patches are held out. */
    role: 'fit' | 'validation';
}

/** Rectangular ROI in ORIGINAL (natural) image pixel coordinates. */
export interface RoiRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Image-derived optical statistics for a selected ROI.
 * These describe the uploaded picture only — never clinical/AST outcomes.
 */
export interface RoiStatistics {
    /** Number of pixel samples actually averaged. */
    samples: number;
    /** True when the ROI was resampled to stay within the sampling budget. */
    resampled: boolean;
    meanR: number;
    meanG: number;
    meanB: number;
    /** Mean Rec.709 luminance, 0–255 scale. */
    meanLuminance: number;
    /** Sample standard deviation (n−1) of per-pixel luminance, 0–255 scale. */
    luminanceStdDev: number;
    minLuminance: number;
    maxLuminance: number;
}

export type BadgeTone = 'pass' | 'pending' | 'alert' | 'cyan';

export type ExperimentStatus = 'pass' | 'pending' | 'alert';

/** A single point of the kinetic signal time series. */
export interface KineticPoint {
    /** Human readable time bucket label (x-axis). */
    time: string;
    /** Measured kinetic value. */
    kinetic: number;
    /** Reference / expected value. */
    reference: number;
}

export type KineticRange = '1h' | '24h' | '7d';

/** One device row of the device-comparison chart. */
export interface DeviceComparison {
    device: string;
    /** Mean colour error before optical calibration (ΔE). */
    preCalibration: number;
    /** Mean colour error after optical calibration (ΔE). */
    postCalibration: number;
}

export interface SummaryMetric {
    id: string;
    label: string;
    value: string;
    unit?: string;
    trend?: string;
    note?: string;
}

export interface ExperimentRecord {
    id: string;
    name: string;
    device: string;
    status: ExperimentStatus;
    /** Measured accuracy in percent. */
    accuracy: number;
    createdAt: string;
    duration: string;
    simulated: boolean;
}

export type WorkflowStepStatus = 'complete' | 'active' | 'upcoming';

export interface WorkflowStep {
    id: string;
    index: number;
    title: string;
    description: string;
    status: WorkflowStepStatus;
    detail: string;
}

export interface NewExperimentInput {
    name: string;
    device: string;
    notes: string;
}
