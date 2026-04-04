import { describe, expect, test } from 'bun:test';
import { isPublicRoute } from '../lib/isPublicRoute.js';

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
});
