import { afterAll, expect, test } from 'bun:test';
import { getRuntimeApp, getRuntimeMetricsToken } from './helpers/runtime-app';

let runtimeApp: Awaited<ReturnType<typeof getRuntimeApp>> | null = null;

afterAll(async () => {
	if (runtimeApp) {
		await runtimeApp.cleanup();
	}
});

test('built app health endpoint returns 200', async () => {
	runtimeApp = await getRuntimeApp();

	const response = await runtimeApp.fetch('/api/v1/health');

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ status: 'ok' });
}, 120_000);

test('built app serves the login page', async () => {
	runtimeApp = await getRuntimeApp();

	const response = await runtimeApp.fetch('/login');

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toContain('text/html');
}, 20_000);

test('built app redirects anonymous dashboard traffic to login', async () => {
	runtimeApp = await getRuntimeApp();

	const response = await runtimeApp.fetch('/', { redirect: 'manual' });

	expect(response.status).toBe(302);
	expect(response.headers.get('location')).toBe('/login?returnTo=%2F');
}, 20_000);

test('built app rejects unauthenticated metrics requests in production', async () => {
	runtimeApp = await getRuntimeApp();

	const response = await runtimeApp.fetch('/metrics');

	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ error: 'Unauthorized' });
}, 20_000);

test('built app serves metrics when the production bearer token is provided', async () => {
	runtimeApp = await getRuntimeApp();

	const response = await runtimeApp.fetch('/metrics', {
		headers: {
			Authorization: `Bearer ${getRuntimeMetricsToken()}`
		}
	});

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toContain('text/plain');
	expect(await response.text()).toContain('# HELP');
}, 20_000);
