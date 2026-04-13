import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';
import { isPublicRoute } from '../lib/isPublicRoute.js';
import * as actualConfig from '../lib/server/config.js';
import * as actualConstants from '../lib/server/config/constants.js';

let checkPermissionSpy: ReturnType<typeof spyOn> | undefined;

function createUser(role: User['role'] = 'admin'): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'admin',
		email: null,
		name: 'Admin',
		emailVerified: false,
		image: null,
		role,
		active: true,
		isLocal: true,
		requiresPasswordChange: false,
		createdAt: now,
		updatedAt: now,
		preferences: null
	};
}

async function callMetrics(options: {
	isProd: boolean;
	metricsToken?: string;
	authHeader?: string;
	user?: User | null;
	cluster?: string;
}): Promise<Response> {
	mock.module('$lib/server/config', () => ({ ...actualConfig, IS_PROD: options.isProd }));
	mock.module('$lib/server/config.js', () => ({ ...actualConfig, IS_PROD: options.isProd }));
	mock.module('$lib/server/config/constants', () => ({
		...actualConstants,
		GYRE_METRICS_TOKEN: options.metricsToken ?? ''
	}));
	mock.module('$lib/server/config/constants.js', () => ({
		...actualConstants,
		GYRE_METRICS_TOKEN: options.metricsToken ?? ''
	}));
	mock.module('$lib/server/rate-limiter', () => ({
		checkRateLimit: () => {}
	}));

	const rbacModule = {
		checkPermission: async (
			user: User,
			permission: string,
			_resourceType: string | undefined,
			_namespace: string | undefined,
			cluster: string | undefined
		) => {
			expect(permission).toBe('admin');
			expect(cluster).toBe(options.cluster);
			return user.role === 'admin';
		}
	};
	checkPermissionSpy = spyOn(rbacModule, 'checkPermission').mockImplementation(
		async (
			user: User,
			permission: string,
			_resourceType: string | undefined,
			_namespace: string | undefined,
			cluster: string | undefined
		) => {
			expect(permission).toBe('admin');
			expect(cluster).toBe(options.cluster);
			return user.role === 'admin';
		}
	);
	mock.module('$lib/server/rbac.js', () => rbacModule);
	mock.module('$lib/server/metrics', () => ({
		register: {
			metrics: async () => '# mock metrics\n',
			contentType: 'text/plain; version=0.0.4'
		}
	}));

	const { GET: metricsGET } = await import(
		`../routes/metrics/+server.js?case=${Date.now()}-${Math.random()}`
	);

	const headers = new Headers();
	if (options.authHeader) {
		headers.set('authorization', options.authHeader);
	}

	return metricsGET({
		request: new Request('http://localhost/metrics', { headers }),
		setHeaders: () => {},
		getClientAddress: () => '127.0.0.1',
		locals: {
			user: options.user ?? null,
			cluster: options.cluster
		}
	} as Parameters<typeof metricsGET>[0]);
}

afterEach(() => {
	mock.restore();
	checkPermissionSpy = undefined;
});

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

	test('treats /metrics as hook-public', () => {
		expect(isPublicRoute('/metrics')).toBe(true);
	});
});

describe('metrics handler auth behavior', () => {
	test('returns 401 in production when no bearer token and no authenticated user', async () => {
		const response = await callMetrics({
			isProd: true,
			metricsToken: 'secret-token'
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	test('returns 503 in production when metrics token is unset and request is unauthenticated', async () => {
		const response = await callMetrics({
			isProd: true
		});

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Metrics token is not configured' });
	});

	test('returns 503 in production when metrics token is unset even for admin session', async () => {
		const response = await callMetrics({
			isProd: true,
			user: createUser('admin'),
			cluster: 'cluster-a'
		});

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Metrics token is not configured' });
	});

	test('returns 200 in production with authenticated admin session', async () => {
		const response = await callMetrics({
			isProd: true,
			metricsToken: 'secret-token',
			user: createUser('admin'),
			cluster: 'cluster-a'
		});

		expect(response.status).toBe(200);
		expect((await response.text()).length).toBeGreaterThan(0);
		expect(checkPermissionSpy).toHaveBeenCalled();
	});

	test('returns 403 in production with authenticated non-admin user and no bearer token', async () => {
		const response = await callMetrics({
			isProd: true,
			metricsToken: 'secret-token',
			user: createUser('editor'),
			cluster: 'cluster-a'
		});

		expect(response.status).toBe(403);
		expect(checkPermissionSpy).toHaveBeenCalled();
	});

	test('returns 200 in production with valid bearer token and no session', async () => {
		const response = await callMetrics({
			isProd: true,
			metricsToken: 'secret-token',
			authHeader: 'Bearer secret-token'
		});

		expect(response.status).toBe(200);
		expect((await response.text()).length).toBeGreaterThan(0);
	});

	test('returns 401 in production when bearer token is invalid', async () => {
		const response = await callMetrics({
			isProd: true,
			metricsToken: 'secret-token',
			authHeader: 'Bearer wrong-token'
		});

		expect(response.status).toBe(401);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	test('returns 401 in non-production when token is configured but bearer token is missing', async () => {
		const response = await callMetrics({
			isProd: false,
			metricsToken: 'secret-token'
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	test('returns 200 in non-production when token is configured and bearer token is valid', async () => {
		const response = await callMetrics({
			isProd: false,
			metricsToken: 'secret-token',
			authHeader: 'Bearer secret-token'
		});

		expect(response.status).toBe(200);
		expect((await response.text()).length).toBeGreaterThan(0);
	});

	test('returns 401 in non-production when token is configured and bearer token is invalid', async () => {
		const response = await callMetrics({
			isProd: false,
			metricsToken: 'secret-token',
			authHeader: 'Bearer wrong-token'
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	test('returns 200 in non-production when no token is configured', async () => {
		const response = await callMetrics({
			isProd: false
		});

		expect(response.status).toBe(200);
		expect((await response.text()).length).toBeGreaterThan(0);
	});
});
