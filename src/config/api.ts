export const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

/** Accept either an API base URL or a service origin from Vite configuration. */
export function resolveApiBaseUrl(configuredUrl?: string): string {
    const baseUrl = (configuredUrl?.trim() || LOCAL_API_BASE_URL).replace(/\/+$/, '');
    return baseUrl.toLowerCase().endsWith('/api/v1')
        ? baseUrl
        : `${baseUrl}/api/v1`;
}
