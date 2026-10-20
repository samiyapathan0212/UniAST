import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiUrl, LOCAL_API_BASE_URL, resolveApiBaseUrl } from '../src/config/api.ts';

test('service origin is extended with the versioned API path', () => {
    assert.equal(
        resolveApiBaseUrl('https://uniast-api.onrender.com'),
        'https://uniast-api.onrender.com/api/v1',
    );
});

test('configured API path is preserved without duplicate segments or trailing slash', () => {
    assert.equal(
        resolveApiBaseUrl('https://uniast-api.onrender.com/api/v1/'),
        'https://uniast-api.onrender.com/api/v1',
    );
});

test('repeated API path suffixes are normalized to exactly one segment', () => {
    assert.equal(
        resolveApiBaseUrl('http://127.0.0.1:8000/api/v1/api/v1/'),
        'http://127.0.0.1:8000/api/v1',
    );
});

test('session list URL contains one API prefix and the expected pagination query', () => {
    assert.equal(
        buildApiUrl('/sessions?limit=50&offset=0', 'http://127.0.0.1:8000/api/v1'),
        'http://127.0.0.1:8000/api/v1/sessions?limit=50&offset=0',
    );
});

test('missing or blank configuration uses the local development API', () => {
    assert.equal(resolveApiBaseUrl(), LOCAL_API_BASE_URL);
    assert.equal(resolveApiBaseUrl('   '), LOCAL_API_BASE_URL);
});
