import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	getRuntimeAdminPassword,
	getRuntimeApp,
	getRuntimeMetricsToken
} from './helpers/runtime-app';

let runtimeApp: Awaited<ReturnType<typeof getRuntimeApp>> | null = null;

beforeAll(async () => {
	runtimeApp = await getRuntimeApp();
}, 120_000);

afterAll(async () => {
	if (runtimeApp) {
		await runtimeApp.cleanup();
	}
});

function extractCookieHeader(response: Response): string {
	const setCookies =
		typeof response.headers.getSetCookie === 'function'
			? response.headers.getSetCookie()
			: (() => {
					const setCookie = response.headers.get('set-cookie');
					return setCookie ? [setCookie] : [];
				})();

	return setCookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

test('built app health endpoint returns 200', async () => {
	const response = await runtimeApp!.fetch('/api/v1/health');

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ status: 'ok' });
}, 20_000);

test('built app serves the login page', async () => {
	const response = await runtimeApp!.fetch('/login');

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toContain('text/html');
}, 20_000);

test('built app redirects anonymous dashboard traffic to login', async () => {
	const response = await runtimeApp!.fetch('/', { redirect: 'manual' });

	expect(response.status).toBe(302);
	expect(response.headers.get('location')).toBe('/login?returnTo=%2F');
}, 20_000);

test('built app rejects unauthenticated metrics requests in production', async () => {
	const response = await runtimeApp!.fetch('/metrics');

	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ error: 'Unauthorized' });
}, 20_000);

test('built app serves metrics when the production bearer token is provided', async () => {
	const response = await runtimeApp!.fetch('/metrics', {
		headers: {
			Authorization: `Bearer ${getRuntimeMetricsToken()}`
		}
	});

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toContain('text/plain');
	expect(await response.text()).toContain('# HELP');
}, 20_000);

test('built app downloads plain backups through the adapter-node runtime', async () => {
	const filename = 'gyre-backup-2026-04-24T10-30-00-000Z.db';
	const backupBody = Buffer.from('plain-backup-smoke');
	mkdirSync(runtimeApp!.backupDir, { recursive: true });
	writeFileSync(join(runtimeApp!.backupDir, filename), backupBody);

	const loginResponse = await runtimeApp!.fetch('/api/v1/auth/login', {
		body: JSON.stringify({
			username: 'admin',
			password: getRuntimeAdminPassword()
		}),
		headers: {
			'content-type': 'application/json'
		},
		method: 'POST'
	});
	expect(loginResponse.status).toBe(200);

	const cookieHeader = extractCookieHeader(loginResponse);
	expect(cookieHeader).toContain('gyre_session=');

	const response = await runtimeApp!.fetch(
		`/api/v1/admin/backups/download?filename=${encodeURIComponent(filename)}`,
		{
			headers: {
				Cookie: cookieHeader
			}
		}
	);

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe('application/x-sqlite3');
	expect(response.headers.get('content-length')).toBe(String(backupBody.byteLength));
	expect(Buffer.from(await response.arrayBuffer())).toEqual(backupBody);
}, 20_000);
