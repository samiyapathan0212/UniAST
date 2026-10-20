export const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

/** Accept either an API base URL or a service origin from Vite configuration. */
export function resolveApiBaseUrl(configuredUrl?: string): string {
    const baseUrl = (configuredUrl?.trim() || LOCAL_API_BASE_URL).replace(/\/+$/, '');
    // Treat the configured value as either a service origin or an API base,
    // while collapsing accidental repeated API suffixes to exactly one.
    return `${baseUrl.replace(/(?:\/api\/v1)+$/i, '')}/api/v1`;
}

export function buildApiUrl(path: string, configuredUrl?: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${resolveApiBaseUrl(configuredUrl)}${normalizedPath}`;
}
