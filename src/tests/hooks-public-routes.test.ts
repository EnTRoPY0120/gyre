import { describe, expect, mock, test } from 'bun:test';

mock.module('$lib/server/logger.js', () => ({
	logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
	withRequestContext: async (_requestId: string, fn: () => unknown) => await fn()
}));

mock.module('$lib/server/auth/better-auth', () => ({
	getBetterAuthSession: async () => null
}));

mock.module('$lib/server/initialize', () => ({
	initializeGyre: async () => {}
}));

mock.module('$lib/server/metrics', () => ({
	httpRequestDurationMicroseconds: {
		labels: () => ({ observe: () => {} })
	}
}));

mock.module('$lib/server/request-limits', () => ({
	getRequestSizeLimit: () => 1024,
	validateRequestSize: () => ({ valid: true, size: 0, limit: 1024 }),
	formatSize: () => '1 KB'
}));

mock.module('$lib/server/csrf', () => ({
	generateCsrfToken: () => 'csrf-token',
	validateCsrfToken: () => true
}));

mock.module('$lib/server/config', () => ({
	CSRF_COOKIE_OPTIONS: {
		path: '/',
		httpOnly: false,
		secure: false,
		sameSite: 'strict',
		maxAge: 60
	},
	IS_PROD: false,
	ADMIN_ROUTE_PREFIXES: ['/api/admin', '/api/v1/admin']
}));

mock.module('$lib/server/rate-limiter', () => ({
	tryCheckRateLimit: () => ({ limited: false, retryAfter: 0 })
}));

mock.module('$lib/server/clusters', () => ({
	getClusterById: async () => null
}));

mock.module('$lib/server/kubernetes/errors', () => ({
	errorToHttpResponse: () => new Response(null, { status: 500 })
}));

mock.module('$lib/utils/error-normalization', () => ({
	normalizeError: (error: unknown) => error
}));

import { isPublicRoute } from '../hooks.server.js';

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
});
