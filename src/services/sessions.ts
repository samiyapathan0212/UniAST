import { buildApiUrl } from '../config/api.ts';

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

export interface UpdateResearchSession {
    name?: string;
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

export function createSessionApi(fetcher: typeof fetch, configuredApiBaseUrl?: string) {
    async function request<T>(path: string, init?: RequestInit): Promise<T> {
        const requestUrl = buildApiUrl(path, configuredApiBaseUrl);
        let response: Response;
        try {
            response = await fetcher(requestUrl, {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    ...init?.headers,
                },
            });
        } catch {
            throw new Error(
                `Could not reach ${requestUrl}. The browser could not complete the request; check backend availability and whether CORS allows this page's origin. Local image analysis and CSV export remain available.`,
            );
        }

        if (!response.ok) {
            let detail: unknown;
            try {
                detail = (await response.json())?.detail;
            } catch {
                // Use the status-based fallback below when the response has no JSON body.
            }
            const detailMessage = formatApiError(detail);
            if (response.status >= 500) {
                throw new Error(
                    `Session service returned HTTP ${response.status}${detailMessage ? `: ${detailMessage}` : ''}. Check backend logs for database or server errors.`,
                );
            }
            throw new Error(detailMessage ?? `Session service returned HTTP ${response.status}.`);
        }

        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
    }

    return {
        listResearchSessions(limit = 50, offset = 0): Promise<ResearchSessionList> {
            const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
            return request<ResearchSessionList>(`/sessions?${query.toString()}`);
        },
        createResearchSession(payload: CreateResearchSession): Promise<ResearchSession> {
            return request<ResearchSession>('/sessions', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        },
        getResearchSession(id: string): Promise<ResearchSession> {
            return request<ResearchSession>(`/sessions/${encodeURIComponent(id)}`);
        },
        updateResearchSession(id: string, payload: UpdateResearchSession): Promise<ResearchSession> {
            return request<ResearchSession>(`/sessions/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
            });
        },
        deleteResearchSession(id: string): Promise<void> {
            return request<void>(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        },
        listAnalysisRecords(sessionId: string, kind: AnalysisKind): Promise<AnalysisRecordList> {
            return request<AnalysisRecordList>(`/sessions/${encodeURIComponent(sessionId)}/${kind}`);
        },
        saveAnalysisRecord<TPayload, TRecord extends AnalysisRecordBase>(
            sessionId: string,
            kind: AnalysisKind,
            payload: TPayload,
        ): Promise<TRecord> {
            return request<TRecord>(`/sessions/${encodeURIComponent(sessionId)}/${kind}`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        },
        getAnalysisRecord<TRecord extends AnalysisRecordBase>(
            sessionId: string,
            kind: AnalysisKind,
            recordId: string,
        ): Promise<TRecord> {
            return request<TRecord>(
                `/sessions/${encodeURIComponent(sessionId)}/${kind}/${encodeURIComponent(recordId)}`,
            );
        },
        deleteAnalysisRecord(sessionId: string, kind: AnalysisKind, recordId: string): Promise<void> {
            return request<void>(
                `/sessions/${encodeURIComponent(sessionId)}/${kind}/${encodeURIComponent(recordId)}`,
                { method: 'DELETE' },
            );
        },
    };
}

const sessionApi = createSessionApi(fetch, import.meta.env?.VITE_API_BASE_URL);

export const {
    listResearchSessions,
    createResearchSession,
    getResearchSession,
    updateResearchSession,
    deleteResearchSession,
    listAnalysisRecords,
    saveAnalysisRecord,
    getAnalysisRecord,
    deleteAnalysisRecord,
} = sessionApi;
