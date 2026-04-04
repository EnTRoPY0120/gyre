import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_DIR = import.meta.dir;

function readRepoFile(relativePath: string): string {
	return readFileSync(resolve(TEST_DIR, '..', relativePath), 'utf8');
}

describe('auth source regressions', () => {
	test('configures Better Auth session cookies via advanced.cookies.session_token', () => {
		const source = readRepoFile('lib/server/auth/better-auth.ts');

		expect(source).toContain('advanced: {');
		expect(source).toContain('defaultCookieAttributes: DEFAULT_COOKIE_OPTIONS');
		expect(source).toMatch(
			/cookies:\s*\{\s*session_token:\s*\{\s*name:\s*BETTER_AUTH_SESSION_COOKIE_NAME,\s*attributes:\s*DEFAULT_COOKIE_OPTIONS/s
		);
	});

	test('shares the session cookie name constant across hooks and auth routes', () => {
		const hooksSource = readRepoFile('hooks.server.ts');
		const loginSource = readRepoFile('routes/api/v1/auth/login/+server.ts');
		const logoutSource = readRepoFile('routes/api/v1/auth/logout/+server.ts');

		expect(hooksSource).toContain('BETTER_AUTH_SESSION_COOKIE_NAME');
		expect(loginSource).toContain('BETTER_AUTH_SESSION_COOKIE_NAME');
		expect(logoutSource).toContain('BETTER_AUTH_SESSION_COOKIE_NAME');

		expect(hooksSource).not.toContain("'gyre_session'");
		expect(loginSource).not.toContain("'gyre_session'");
		expect(logoutSource).not.toContain("'gyre_session'");
	});

	test('guards first-login password-change redirects behind canChangePassword', () => {
		const source = readRepoFile('routes/login/+page.svelte');

		expect(source).toContain(
			'if (result.user?.requiresPasswordChange && result.user?.canChangePassword)'
		);
	});

	test('does not seed in-cluster admin into an impossible password-change flow', () => {
		const source = readRepoFile('lib/server/auth.ts');

		expect(source).toMatch(
			/if \(isInClusterMode\(\)\) \{[\s\S]*?requiresPasswordChange: false[\s\S]*?return \{ password, mode: 'in-cluster' \};/s
		);
	});
});
