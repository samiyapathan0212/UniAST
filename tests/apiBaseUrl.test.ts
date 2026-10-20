import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_API_BASE_URL, resolveApiBaseUrl } from '../src/config/api.ts';

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

test('missing or blank configuration uses the local development API', () => {
    assert.equal(resolveApiBaseUrl(), LOCAL_API_BASE_URL);
    assert.equal(resolveApiBaseUrl('   '), LOCAL_API_BASE_URL);
});
