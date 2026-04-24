import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';
import { IN_CLUSTER_ID } from '../lib/clusters/identity.js';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { createCookies } from './helpers/cookies';
import {
	createKubernetesErrorsModuleStub,
	createLoggerModuleStub,
	createRateLimiterModuleStub,
	createRbacModuleStub,
	createSettingsModuleStub
} from './helpers/module-stubs';

type FluxVersionRouteModule = typeof import('../routes/api/v1/flux/version/+server.js');
type AdminSettingsRouteModule = typeof import('../routes/api/v1/admin/settings/+server.js');
type RootPageModule = typeof import('../routes/+page.server.js');

let sessionData: {
	session: { id: string };
	user: User;
} | null = null;
let csrfValid = true;
let clusterRecord: { id: string; isActive: boolean } | null = { id: 'cluster-a', isActive: true };
let clusterWideReadAllowed = true;
const resolvedRoutes: string[] = [];

function createUser(role: User['role'] = 'admin'): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: role,
		email: null,
		name: role,
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

async function importHooks() {
	return importFresh<typeof import('../hooks.server.js')>('../hooks.server.js');
}

async function resolveTestRoute(event: RequestEvent): Promise<Response> {
	const routeKey = `${event.request.method} ${event.url.pathname}`;
	resolvedRoutes.push(routeKey);

	if (routeKey === 'GET /api/v1/flux/version') {
		const routeModule = await importFresh<FluxVersionRouteModule>(
			'../routes/api/v1/flux/version/+server.js'
		);
		return await routeModule.GET(event as Parameters<FluxVersionRouteModule['GET']>[0]);
	}

	if (routeKey === 'GET /api/v1/admin/settings') {
		const routeModule = await importFresh<AdminSettingsRouteModule>(
			'../routes/api/v1/admin/settings/+server.js'
		);
		return await routeModule.GET(event as Parameters<AdminSettingsRouteModule['GET']>[0]);
	}

	if (routeKey === 'PATCH /api/v1/admin/settings') {
		const routeModule = await importFresh<AdminSettingsRouteModule>(
			'../routes/api/v1/admin/settings/+server.js'
		);
		return await routeModule.PATCH(event as Parameters<AdminSettingsRouteModule['PATCH']>[0]);
	}

	if (routeKey === 'GET /') {
		const pageModule = await importFresh<RootPageModule>('../routes/+page.server.js');
		const data = await pageModule.load({
			depends: () => {},
			locals: event.locals,
			parent: async () => ({
				health: {
					connected: true,
					currentClusterId: event.locals.cluster ?? IN_CLUSTER_ID,
					currentClusterName: event.locals.cluster ?? IN_CLUSTER_ID,
					availableClusters: []
				}
			}),
			setHeaders: () => {}
		} as Parameters<RootPageModule['load']>[0]);
		return Response.json(data);
	}

	throw new Error(`Unhandled test route: ${routeKey}`);
}

function createEvent(
	path: string,
	init: RequestInit = {},
	initialCookies: Record<string, string> = {}
) {
	const cookies = createCookies(initialCookies);
	const event = {
		cookies,
		getClientAddress: () => '127.0.0.1',
		locals: {} as App.Locals,
		request: new Request(`http://localhost${path}`, init),
		route: { id: path },
		url: new URL(`http://localhost${path}`)
	};

	return { cookies, event };
}

beforeEach(() => {
	sessionData = null;
	csrfValid = true;
	clusterRecord = { id: 'cluster-a', isActive: true };
	clusterWideReadAllowed = true;
	resolvedRoutes.length = 0;

	mock.module('$lib/server/logger.js', () => createLoggerModuleStub());
	mock.module('$lib/server/metrics.js', () => ({
		httpRequestDurationMicroseconds: {
			labels: () => ({
				observe: () => {}
			})
		},
		loginAttemptsTotal: { labels: () => ({ inc: () => {} }) },
		sessionsCleanedUpTotal: { inc: () => {} }
	}));
	mock.module('$lib/server/initialize.js', () => ({
		initializeGyre: async () => {}
	}));

	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);

	const betterAuthModuleStub = {
		BETTER_AUTH_SESSION_COOKIE_NAME: 'gyre_session',
		getBetterAuthSession: async () => sessionData,
		createBetterAuthSessionForUser: async () => {},
		revokeBetterAuthSessionByCookieValue: async () => {},
		ensureBetterAuthOAuthAccount: async () => {},
		applyBetterAuthCookies: () => {},
		getBetterAuth: () => ({
			api: {
				changePassword: async () => ({ headers: new Headers() }),
				signOut: async () => ({ headers: new Headers() })
			}
		})
	};
	mock.module('$lib/server/auth/better-auth.js', () => betterAuthModuleStub);
	mock.module('$lib/server/auth/better-auth', () => betterAuthModuleStub);

	mock.module('$lib/server/csrf.js', () => ({
		generateCsrfToken: (sessionId: string) => `csrf:${sessionId}`,
		validateCsrfToken: (_sessionId: string, token: string) => csrfValid && token.startsWith('csrf:')
	}));

	mock.module('$lib/server/clusters/repository.js', () => ({
		getClusterById: async () => clusterRecord,
		getSelectableClusters: async () => []
	}));

	mock.module('$lib/server/kubernetes/errors.js', () => createKubernetesErrorsModuleStub());
	mock.module('$lib/server/rbac.js', () =>
		createRbacModuleStub({
			checkClusterWideReadPermission: async () => clusterWideReadAllowed,
			checkPermission: async (user, action) => {
				if (action === 'admin') {
					return (user as User | null | undefined)?.role === 'admin';
				}
				return clusterWideReadAllowed;
			}
		})
	);
	mock.module('$lib/server/flux/services.js', () => ({
		getFluxInstalledVersion: async () => ({ version: 'v2.3.0' })
	}));
	mock.module('$lib/server/settings', () => createSettingsModuleStub());
	mock.module('$lib/server/audit', () => ({
		logAudit: async () => {}
	}));
});

afterEach(() => {
	mock.restore();
});

describe('request pipeline runtime coverage', () => {
	test('authenticated requests that pass the gates resolve the real route handler', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		const { handle } = await importHooks();
		const { event } = createEvent('/api/v1/flux/version', undefined, {
			gyre_session: 'session-cookie'
		});

		const response = await handle({
			event,
			resolve: resolveTestRoute
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ version: 'v2.3.0' });
		expect(resolvedRoutes).toEqual(['GET /api/v1/flux/version']);
	});

	test('anonymous page requests redirect to login through the real pipeline', async () => {
		const { handle } = await importHooks();
		const { event } = createEvent('/');

		const response = await handle({
			event,
			resolve: resolveTestRoute
		});

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/login?returnTo=%2F');
		expect(resolvedRoutes).toEqual([]);
	});

	test('anonymous protected API requests return 401 before route resolution', async () => {
		const { handle } = await importHooks();
		const { event } = createEvent('/api/v1/flux/version');

		const response = await handle({
			event,
			resolve: resolveTestRoute
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: 'Unauthorized',
			message: 'Authentication required'
		});
		expect(resolvedRoutes).toEqual([]);
	});

	test('authenticated state-changing requests without a valid CSRF token return 403', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		csrfValid = false;
		const { handle } = await importHooks();
		const { event } = createEvent(
			'/api/v1/admin/settings',
			{
				body: JSON.stringify({ localLoginEnabled: true }),
				headers: {
					'content-type': 'application/json'
				},
				method: 'PATCH'
			},
			{ gyre_session: 'session-cookie' }
		);

		const response = await handle({
			event,
			resolve: resolveTestRoute
		});

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Forbidden',
			message: 'Invalid or missing CSRF token'
		});
		expect(resolvedRoutes).toEqual([]);
	});

	test('authenticated non-admin users are blocked from admin routes before handler execution', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser('editor')
		};
		const { handle } = await importHooks();
		const { event } = createEvent('/api/v1/admin/settings', undefined, {
			gyre_session: 'session-cookie'
		});

		const response = await handle({
			event,
			resolve: resolveTestRoute
		});

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Forbidden',
			message: 'Admin access required'
		});
		expect(resolvedRoutes).toEqual([]);
	});
});
