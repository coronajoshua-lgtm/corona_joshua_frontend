import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test } from 'node:test';

// Load the browser module with a test API URL, without requiring a Vite server.
const source = (await readFile(new URL('../src/api.js', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_API_URL', "'http://api.example.test/api'");
const { request } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

test('registration preserves JSON validation errors and HTTP status', async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Accept, 'application/json');
    return new Response(JSON.stringify({ error: 'Email is already registered.' }), { status: 409 });
  };
  await assert.rejects(request('/auth/register', { method: 'POST', body: '{}' }),
    (error) => error.message === 'Email is already registered.' && error.status === 409);
});

test('an HTML database error gives an actionable error instead of SyntaxError', async () => {
  globalThis.fetch = async () => new Response('<!DOCTYPE html><html>Database error</html>', { status: 500 });
  await assert.rejects(request('/auth/register', { method: 'POST', body: '{}' }), (error) => {
    assert.equal(error.status, 500);
    assert.match(error.message, /HTML page.*HTTP 500/);
    assert.match(error.message, /backend server logs/);
    assert.equal(error instanceof SyntaxError, false);
    return true;
  });
});

test('an empty API response reports its HTTP status', async () => {
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(request('/auth/register'),
    (error) => error.status === 503 && /empty response.*HTTP 503/.test(error.message));
});

test('HTML returned during token refresh also gets a readable error', async () => {
  localStorage.setItem('refreshToken', 'test-refresh-token');
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    : new Response('<!DOCTYPE html><html>Wrong server</html>', { status: 200 });
  await assert.rejects(request('/products'),
    (error) => /HTML page.*HTTP 200/.test(error.message) && !(error instanceof SyntaxError));
});

test('successful registration still returns the account and tokens', async () => {
  const account = { user: { id: 1 }, tokens: { access_token: 'access', refresh_token: 'refresh' } };
  globalThis.fetch = async () => new Response(JSON.stringify(account), { status: 201 });
  assert.deepEqual(await request('/auth/register', { method: 'POST', body: '{}' }), account);
});

test('invalid sign-in never refreshes or uses a previously saved session', async () => {
  localStorage.setItem('accessToken', 'previous-access-token');
  localStorage.setItem('refreshToken', 'previous-refresh-token');
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify({ error: 'Invalid credentials.' }), { status: 401 });
  };
  await assert.rejects(request('/auth/login', { method: 'POST', body: '{}' }),
    (error) => error.message === 'Invalid credentials.' && error.status === 401);
  assert.deepEqual(calls, ['http://api.example.test/api/auth/login']);
});

test('registration does not attach a previously saved access token', async () => {
  localStorage.setItem('accessToken', 'previous-access-token');
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify({ error: 'Invalid email.' }), { status: 422 });
  };
  await assert.rejects(request('/auth/register', { method: 'POST', body: '{}' }),
    (error) => error.message === 'Invalid email.');
});
