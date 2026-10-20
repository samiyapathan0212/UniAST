import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionApi } from '../src/services/sessions.ts';

interface FetchCall {
    url: string;
    init?: RequestInit;
}

function fakeFetch(responses: Array<Response | Error>) {
    const calls: FetchCall[] = [];
    const fetcher: typeof fetch = async (input, init) => {
        calls.push({ url: String(input), init });
        const response = responses.shift();
        if (response instanceof Error) throw response;
        if (!response) throw new Error('No mocked response remains.');
        return response;
    };
    return { calls, fetcher };
}

function jsonResponse(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const sessionRecord = {
    id: 'session-123',
    name: 'Updated panel',
    device: null,
    notes: null,
    createdAt: '2026-10-21T12:00:00Z',
    updatedAt: '2026-10-21T12:01:00Z',
};

test('session update uses PATCH, supported fields, and configured API prefix', async () => {
    const { calls, fetcher } = fakeFetch([jsonResponse(sessionRecord)]);
    const api = createSessionApi(fetcher, 'http://127.0.0.1:8000/api/v1/');

    const result = await api.updateResearchSession('session-123', {
        name: 'Updated panel',
        device: null,
        notes: null,
    });

    assert.equal(result.name, 'Updated panel');
    assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/v1/sessions/session-123');
    assert.equal(calls[0].init?.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
        name: 'Updated panel',
        device: null,
        notes: null,
    });
});

test('session delete uses DELETE, accepts 204, and a subsequent list refresh returns current rows', async () => {
    const initialList = {
        items: [sessionRecord], limit: 50, offset: 0, total: 1,
    };
    const refreshedList = { items: [], limit: 50, offset: 0, total: 0 };
    const { calls, fetcher } = fakeFetch([
        jsonResponse(initialList),
        new Response(null, { status: 204 }),
        jsonResponse(refreshedList),
    ]);
    const api = createSessionApi(fetcher, 'http://localhost:8000');

    assert.equal((await api.listResearchSessions()).total, 1);
    await api.deleteResearchSession('session-123');
    const refreshed = await api.listResearchSessions();

    assert.equal(calls[1].url, 'http://localhost:8000/api/v1/sessions/session-123');
    assert.equal(calls[1].init?.method, 'DELETE');
    assert.deepEqual(refreshed.items, []);
    assert.equal(refreshed.total, 0);
});

test('analysis record delete uses the session-scoped route and accepts 204', async () => {
    const { calls, fetcher } = fakeFetch([new Response(null, { status: 204 })]);
    const api = createSessionApi(fetcher, 'http://localhost:8000/api/v1');

    await api.deleteAnalysisRecord('session-123', 'kinetic-analyses', 'record-456');

    assert.equal(
        calls[0].url,
        'http://localhost:8000/api/v1/sessions/session-123/kinetic-analyses/record-456',
    );
    assert.equal(calls[0].init?.method, 'DELETE');
});

test('HTTP errors retain backend detail for the UI', async () => {
    const { fetcher } = fakeFetch([jsonResponse({ detail: 'Session not found.' }, 404)]);
    const api = createSessionApi(fetcher, 'http://localhost:8000');

    await assert.rejects(api.deleteResearchSession('missing'), /Session not found\./);
});

test('server errors direct the user to backend logs for database or service diagnostics', async () => {
    const { fetcher } = fakeFetch([jsonResponse({ detail: 'Internal Server Error' }, 500)]);
    const api = createSessionApi(fetcher, 'http://localhost:8000');

    await assert.rejects(
        api.deleteResearchSession('session-123'),
        /HTTP 500: Internal Server Error\. Check backend logs for database or server errors\./,
    );
});

test('network failures explain that connectivity or CORS may be blocking the request', async () => {
    const { fetcher } = fakeFetch([new TypeError('Failed to fetch')]);
    const api = createSessionApi(fetcher, 'http://127.0.0.1:8000');

    await assert.rejects(
        api.deleteResearchSession('session-123'),
        /backend availability and whether CORS allows this page's origin/,
    );
});
