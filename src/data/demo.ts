/* ==========================================================================
   SIMULATED DEMO DATA — Milestone 1
   --------------------------------------------------------------------------
   Everything in this module is fabricated sample data used to render the
   dashboard before the Flask backend exists. Nothing here comes from a real
   measurement, and every surface that displays it is labelled "SIMULATED".
   Replace these exports with API calls in a later milestone.
   ========================================================================== */
import type {
    DeviceComparison,
    ExperimentRecord,
    KineticPoint,
    KineticRange,
    SummaryMetric,
    WorkflowStep,
} from '../types';

export const DISCLAIMER = {
    badge: 'Research',
    text: 'UniAST is an academic research prototype. Dashboard figures and simulated previews use demo data. Outputs from user-uploaded images or CSVs are research measurements only; no output is clinically validated.',
};

export const STATUS_PILL = 'Research Prototype — Demo Data';

/** Summary metrics for the dashboard header (simulated). */
export const SUMMARY_METRICS: SummaryMetric[] = [
    {
        id: 'experiments',
        label: 'Experiments Logged',
        value: '128',
        trend: '+12 this week',
        note: 'Total runs across all devices',
    },
    {
        id: 'mean-error',
        label: 'Mean Colour Error',
        value: '1.94',
        unit: 'ΔE',
        trend: '−0.31 vs baseline',
        note: 'Post-calibration average',
    },
    {
        id: 'devices',
        label: 'Calibrated Devices',
        value: '14',
        unit: '/ 16',
        trend: '+2 this month',
        note: 'Reference panels on file',
    },
    {
        id: 'signal-snr',
        label: 'Median Signal SNR',
        value: '38.6',
        unit: 'dB',
        trend: '+1.4 dB',
        note: 'Kinetic capture quality',
    },
];

/** Kinetic line-chart series per selectable time range (simulated). */
export const KINETIC_SERIES: Record<KineticRange, KineticPoint[]> = {
    '1h': [
        { time: '00m', kinetic: 42.1, reference: 40.0 },
        { time: '05m', kinetic: 43.6, reference: 40.4 },
        { time: '10m', kinetic: 46.9, reference: 40.9 },
        { time: '15m', kinetic: 45.2, reference: 41.2 },
        { time: '20m', kinetic: 49.8, reference: 41.5 },
        { time: '25m', kinetic: 53.4, reference: 41.9 },
        { time: '30m', kinetic: 51.7, reference: 42.2 },
        { time: '35m', kinetic: 56.3, reference: 42.5 },
        { time: '40m', kinetic: 59.1, reference: 42.8 },
        { time: '45m', kinetic: 57.4, reference: 43.1 },
        { time: '50m', kinetic: 61.8, reference: 43.4 },
        { time: '55m', kinetic: 64.2, reference: 43.7 },
    ],
    '24h': [
        { time: '00:00', kinetic: 31.2, reference: 33.0 },
        { time: '02:00', kinetic: 29.8, reference: 33.1 },
        { time: '04:00', kinetic: 30.4, reference: 33.2 },
        { time: '06:00', kinetic: 34.9, reference: 33.5 },
        { time: '08:00', kinetic: 41.6, reference: 34.0 },
        { time: '10:00', kinetic: 48.2, reference: 34.6 },
        { time: '12:00', kinetic: 52.7, reference: 35.1 },
        { time: '14:00', kinetic: 50.4, reference: 35.5 },
        { time: '16:00', kinetic: 55.9, reference: 35.9 },
        { time: '18:00', kinetic: 58.3, reference: 36.2 },
        { time: '20:00', kinetic: 54.1, reference: 36.4 },
        { time: '22:00', kinetic: 46.7, reference: 36.5 },
    ],
    '7d': [
        { time: 'Mon', kinetic: 38.4, reference: 36.0 },
        { time: 'Tue', kinetic: 42.7, reference: 36.4 },
        { time: 'Wed', kinetic: 47.1, reference: 36.9 },
        { time: 'Thu', kinetic: 45.6, reference: 37.3 },
        { time: 'Fri', kinetic: 53.2, reference: 37.7 },
        { time: 'Sat', kinetic: 57.8, reference: 38.1 },
        { time: 'Sun', kinetic: 61.4, reference: 38.5 },
    ],
};

/** Device comparison chart rows — mean ΔE before/after calibration (simulated). */
export const DEVICE_COMPARISON: DeviceComparison[] = [
    { device: 'Pixel 8', preCalibration: 6.8, postCalibration: 1.6 },
    { device: 'iPhone 15', preCalibration: 7.4, postCalibration: 2.1 },
    { device: 'Galaxy S24', preCalibration: 5.9, postCalibration: 1.4 },
    { device: 'OnePlus 12', preCalibration: 8.2, postCalibration: 2.6 },
    { device: 'Xiaomi 14', preCalibration: 7.1, postCalibration: 1.9 },
];

/** Recent experiments table rows (simulated). */
export const RECENT_EXPERIMENTS: ExperimentRecord[] = [
    {
        id: 'EXP-2041',
        name: 'OLED panel drift sweep',
        device: 'Pixel 8',
        status: 'pass',
        accuracy: 98.2,
        createdAt: '2026-10-18 14:22',
        duration: '4m 12s',
        simulated: true,
    },
    {
        id: 'EXP-2040',
        name: 'Ambient light compensation',
        device: 'iPhone 15',
        status: 'pass',
        accuracy: 96.8,
        createdAt: '2026-10-18 11:05',
        duration: '3m 47s',
        simulated: true,
    },
    {
        id: 'EXP-2039',
        name: 'Low-luminance ROI capture',
        device: 'Galaxy S24',
        status: 'pending',
        accuracy: 0,
        createdAt: '2026-10-17 17:40',
        duration: '—',
        simulated: true,
    },
    {
        id: 'EXP-2038',
        name: 'Warm-white calibration run',
        device: 'OnePlus 12',
        status: 'alert',
        accuracy: 71.4,
        createdAt: '2026-10-17 09:18',
        duration: '6m 03s',
        simulated: true,
    },
    {
        id: 'EXP-2037',
        name: 'Panel uniformity grid',
        device: 'Xiaomi 14',
        status: 'pass',
        accuracy: 97.5,
        createdAt: '2026-10-16 15:52',
        duration: '5m 31s',
        simulated: true,
    },
    {
        id: 'EXP-2036',
        name: 'Reflection suppression test',
        device: 'Pixel 8',
        status: 'pending',
        accuracy: 0,
        createdAt: '2026-10-16 10:27',
        duration: '—',
        simulated: true,
    },
];

/** Research workflow indicator steps. */
export const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        id: 'capture',
        index: 1,
        title: 'Image Capture',
        description: 'Upload a reference photo of the target panel.',
        status: 'complete',
        detail: 'Available in the Image Workspace: drag-and-drop or file-picker upload, decoded entirely in the browser (PNG, JPEG, WebP).',
    },
    {
        id: 'roi',
        index: 2,
        title: 'ROI Selection',
        description: 'Mark the measured region of interest.',
        status: 'complete',
        detail: 'Draw, nudge and clear rectangular regions on the Image Workspace preview; coordinates and statistics always use original image pixels.',
    },
    {
        id: 'calibration',
        index: 3,
        title: 'Optical Calibration',
        description: 'Apply the data-driven correction matrix.',
        status: 'active',
        detail: 'The browser-only Calibration Workspace fits per-channel affine correction from user-entered reference patches and reports fit error separately from held-out validation error. It has no laboratory or clinical validation.',
    },
    {
        id: 'signal',
        index: 4,
        title: 'Signal Extraction',
        description: 'Derive the kinetic signal from the ROI.',
        status: 'upcoming',
        detail: 'The browser-only Kinetic Analysis workspace measures image ROIs or imports CSV observations, then reports descriptive optical changes and rates. These are not bacterial growth or susceptibility results.',
    },
    {
        id: 'report',
        index: 5,
        title: 'Analysis Report',
        description: 'Review accuracy, drift and confidence.',
        status: 'upcoming',
        detail: 'Reporting will consume real experiment records once the backend and database exist.',
    },
];

/** Supported devices for the New Experiment form. */
export const DEVICE_OPTIONS = [
    'Pixel 8',
    'iPhone 15',
    'Galaxy S24',
    'OnePlus 12',
    'Xiaomi 14',
] as const;
