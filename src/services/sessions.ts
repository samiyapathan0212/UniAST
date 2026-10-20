export interface ResearchSession {
    id: string;
    name: string;
    device: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateResearchSession {
    name: string;
    device?: string | null;
    notes?: string | null;
}

export interface ResearchSessionList {
    items: ResearchSession[];
    limit: number;
    offset: number;
    total: number;
}

export type AnalysisKind = 'image-analyses' | 'calibrations' | 'kinetic-analyses';

export interface AnalysisRecordSummary {
    id: string;
    createdAt: string;
    methodVersion: string;
}

export interface AnalysisRecordList {
    items: AnalysisRecordSummary[];
    limit: number;
    offset: number;
    total: number;
}

export interface AnalysisRecordBase {
    id: string;
    sessionId: string;
    createdAt: string;
    methodVersion: string;
}

export interface AnalysisSourceMetadata {
    fileName: string;
    mimeType: string | null;
    fileSize: number;
    width: number;
    height: number;
}

export interface ImageAnalysisPayload {
    sourceMetadata: AnalysisSourceMetadata;
    roi: { x: number; y: number; width: number; height: number };
    statistics: {
        samples: number;
        resampled: boolean;
        meanR: number;
        meanG: number;
        meanB: number;
        meanLuminance: number;
        luminanceStdDev: number;
        minLuminance: number;
        maxLuminance: number;
    };
    methodVersion: string;
}

export interface ImageAnalysisRecord extends AnalysisRecordBase, ImageAnalysisPayload {}

export interface CalibrationPatchRecord {
    patchId: string;
    roi: { x: number; y: number; width: number; height: number };
    measured: ImageAnalysisPayload['statistics'];
    reference: { r: number; g: number; b: number };
    standard: string;
    role: 'fit' | 'validation';
}

export interface CalibrationPayload {
    sourceMetadata: AnalysisSourceMetadata;
    patches: CalibrationPatchRecord[];
    model: import('../utils/calibration').CalibrationModel;
    fitErrorSummary: import('../utils/calibration').ResidualSummary | null;
    validationErrorSummary: import('../utils/calibration').ResidualSummary | null;
    methodVersion: string;
}

export interface CalibrationRecord extends AnalysisRecordBase, CalibrationPayload {}

export interface KineticPayload {
    sourceType: 'images' | 'csv';
    calibrationChoice: 'raw' | 'calibrated' | 'mixed';
    observations: import('../utils/kinetics').DerivedObservation[];
    baselineLuminance: number;
    issues: import('../utils/kinetics').SeriesIssue[];
    warnings: string[];
    methodVersion: string;
}

export interface KineticAnalysisRecord extends AnalysisRecordBase, KineticPayload {}

const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

function formatApiError(detail: unknown): string | null {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        const messages = detail
            .map((issue) =>
                issue && typeof issue === 'object' && 'msg' in issue
                    ? String(issue.msg)
                    : null,
            )
            .filter((message): message is string => message !== null);
        if (messages.length > 0) return messages.join(' ');
    }
    return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...init?.headers,
            },
        });
    } catch {
        throw new Error(
            'Could not reach the local session service. Start the backend to save or load sessions; local image analysis and CSV export remain available.',
        );
    }

    if (!response.ok) {
        let detail: unknown;
        try {
            detail = (await response.json())?.detail;
        } catch {
            // Use the status-based fallback below when the response has no JSON body.
        }
        throw new Error(
            formatApiError(detail) ?? `Session service returned HTTP ${response.status}.`,
        );
    }

    return (await response.json()) as T;
}

export function listResearchSessions(
    limit = 50,
    offset = 0,
): Promise<ResearchSessionList> {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request<ResearchSessionList>(`/sessions?${query.toString()}`);
}

export function createResearchSession(
    payload: CreateResearchSession,
): Promise<ResearchSession> {
    return request<ResearchSession>('/sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function getResearchSession(id: string): Promise<ResearchSession> {
    return request<ResearchSession>(`/sessions/${encodeURIComponent(id)}`);
}

export function listAnalysisRecords(
    sessionId: string,
    kind: AnalysisKind,
): Promise<AnalysisRecordList> {
    return request<AnalysisRecordList>(`/sessions/${encodeURIComponent(sessionId)}/${kind}`);
}

export function saveAnalysisRecord<TPayload, TRecord extends AnalysisRecordBase>(
    sessionId: string,
    kind: AnalysisKind,
    payload: TPayload,
): Promise<TRecord> {
    return request<TRecord>(`/sessions/${encodeURIComponent(sessionId)}/${kind}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function getAnalysisRecord<TRecord extends AnalysisRecordBase>(
    sessionId: string,
    kind: AnalysisKind,
    recordId: string,
): Promise<TRecord> {
    return request<TRecord>(
        `/sessions/${encodeURIComponent(sessionId)}/${kind}/${encodeURIComponent(recordId)}`,
    );
}
