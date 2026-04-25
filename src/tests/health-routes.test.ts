import { describe, expect, test } from 'bun:test';

describe('health routes', () => {
	test('api/health and api/v1/health return the same public status payload', async () => {
		const legacyRoute = await import('../routes/api/health/+server.js');
		const versionedRoute = await import('../routes/api/v1/health/+server.js');

		const [legacyResponse, versionedResponse] = await Promise.all([
			legacyRoute.GET({} as Parameters<typeof legacyRoute.GET>[0]),
			versionedRoute.GET({} as Parameters<typeof versionedRoute.GET>[0])
		]);

		expect(legacyResponse.status).toBe(200);
		expect(versionedResponse.status).toBe(200);
		expect(await legacyResponse.json()).toEqual({ status: 'ok' });
		expect(await versionedResponse.json()).toEqual({ status: 'ok' });
	});
});
