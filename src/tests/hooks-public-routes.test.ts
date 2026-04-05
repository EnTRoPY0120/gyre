import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPublicRoute } from '../lib/isPublicRoute.js';

const TEST_DIR = import.meta.dir;

function readRepoFile(relativePath: string): string {
	return readFileSync(resolve(TEST_DIR, '..', relativePath), 'utf8');
}

describe('hooks public auth route detection', () => {
	test('treats arbitrary provider login and callback routes as public', () => {
		expect(isPublicRoute('/api/v1/auth/enterprise-sso/login')).toBe(true);
		expect(isPublicRoute('/api/v1/auth/enterprise-sso/callback')).toBe(true);
		expect(isPublicRoute('/api/auth/custom-provider/login')).toBe(true);
		expect(isPublicRoute('/api/auth/custom-provider/callback')).toBe(true);
	});

	test('does not treat other dynamic auth routes as public', () => {
		expect(isPublicRoute('/api/v1/auth/enterprise-sso/logout')).toBe(false);
		expect(isPublicRoute('/api/v1/auth/enterprise-sso/login/extra')).toBe(false);
	});

	test('requires exact matches for non-prefix public routes', () => {
		expect(isPublicRoute('/login')).toBe(true);
		expect(isPublicRoute('/login/extra')).toBe(false);
		expect(isPublicRoute('/logo.svg')).toBe(true);
		expect(isPublicRoute('/logo.svg/extra')).toBe(false);
	});

	test('keeps /metrics public while using bearer auth only when GYRE_METRICS_TOKEN is configured', () => {
		const source = readRepoFile('routes/metrics/+server.ts');
		const constantsSource = readRepoFile('lib/server/config/constants.ts');

		expect(isPublicRoute('/metrics')).toBe(true);
		expect(source).toContain('if (GYRE_METRICS_TOKEN) {');
		expect(source).toContain('authHeader !== `Bearer ${GYRE_METRICS_TOKEN}`');
		expect(source).not.toContain("locals.user?.role === 'admin'");
		expect(constantsSource).toContain('If unset, /metrics is public.');
	});
});
