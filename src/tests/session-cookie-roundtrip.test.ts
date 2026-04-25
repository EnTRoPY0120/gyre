import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { RequestEvent } from '@sveltejs/kit';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { createCookies } from './helpers/cookies';
import { buildLoginEvent } from './helpers/login-route-event';
import {
	createKubernetesErrorsModuleStub,
	createLoggerModuleStub,
	createRateLimiterModuleStub,
	createRbacModuleStub,
	createSettingsModuleStub
} from './helpers/module-stubs';

type LoginRouteModule = typeof import('../routes/api/v1/auth/login/+server.js');
type FluxVersionRouteModule = typeof import('../routes/api/v1/flux/version/+server.js');
type LogoutRouteModule = typeof import('../routes/api/v1/auth/logout/+server.js');

let activeSession: {
	session: { id: string };
	user: User;
} | null = null;
const sessionLifecycleCalls: string[] = [];
let signOutCalls = 0;

function createUser(): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'alice',
		email: null,
		name: 'Alice',
		emailVerified: false,
		image: null,
		role: 'admin',
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

	if (routeKey === 'GET /api/v1/flux/version') {
		const routeModule = await importFresh<FluxVersionRouteModule>(
			'../routes/api/v1/flux/version/+server.js'
		);
		return await routeModule.GET(event as Parameters<FluxVersionRouteModule['GET']>[0]);
	}

	if (routeKey === 'POST /api/v1/auth/logout') {
		const routeModule = await importFresh<LogoutRouteModule>(
			'../routes/api/v1/auth/logout/+server.js'
		);
		return await routeModule.POST(event as Parameters<LogoutRouteModule['POST']>[0]);
	}

	throw new Error(`Unhandled route in session round-trip test: ${routeKey}`);
}

beforeEach(() => {
	activeSession = null;
	sessionLifecycleCalls.length = 0;
	signOutCalls = 0;

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
	mock.module('$lib/server/request/initialization.js', () => ({
		ensureGyreInitialized: async () => {},
		isGyreInitialized: () => true
	}));
	mock.module('$lib/server/request/rate-limit.js', () => ({
		enforceGlobalRateLimit: () => null
	}));
	mock.module('$lib/server/request/request-size.js', () => ({
		STATE_CHANGING_METHODS: ['POST', 'PUT', 'DELETE', 'PATCH'],
		createPayloadTooLargeResponse: () => new Response('payload too large', { status: 413 }),
		enforceRequestSizeLimits: async () => null,
		isPayloadTooLargeError: () => false
	}));
	mock.module('$lib/server/initialize.js', () => ({
		initializeGyre: async () => {}
	}));

	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);

	mock.module('$lib/server/settings', () =>
		createSettingsModuleStub({
			getAuthSettings: async () => ({
				localLoginEnabled: true,
				allowSignup: false,
				domainAllowlist: []
			})
		})
	);
	const authModuleStub = {
		SESSION_DURATION_DAYS: 30,
		addPasswordHistory: async () => {},
		authenticateUser: async () => createUser(),
		clearRequiresPasswordChange: async () => {},
		cleanupSetupTokenFile: () => {},
		deleteUserSessions: async () => {},
		getCredentialAccount: async () => null,
		getCredentialPasswordHash: async () => null,
		getUserByUsername: async () => createUser(),
		hashPassword: async () => 'hashed-password',
		hasManagedPassword: async () => true,
		isInClusterAdmin: () => false,
		isPasswordInHistory: async () => false,
		normalizeUsername: (username: string) => username.trim().toLowerCase(),
		verifyPassword: async () => true
	};
	mock.module('$lib/server/auth', () => authModuleStub);
	mock.module('$lib/server/auth.js', () => authModuleStub);
	const auditModuleStub = {
		logAudit: async () => {},
		logLogin: async () => {},
		logLogout: async () => {}
	};
	mock.module('$lib/server/audit', () => auditModuleStub);
	mock.module('$lib/server/audit.js', () => auditModuleStub);
	mock.module('$lib/server/rbac.js', () =>
		createRbacModuleStub({
			checkClusterWideReadPermission: async () => true
		})
	);
	mock.module('$lib/server/flux/services.js', () => ({
		getFluxInstalledVersion: async () => ({ version: 'v2.3.0' })
	}));
	mock.module('$lib/server/kubernetes/errors.js', () => createKubernetesErrorsModuleStub());
	mock.module('$lib/server/clusters/repository.js', () => ({
		getClusterById: async () => ({ id: 'cluster-a', isActive: true }),
		getSelectableClusters: async () => []
	}));
	mock.module('$lib/server/csrf.js', () => ({
		generateCsrfToken: (sessionId: string) => `csrf:${sessionId}`,
		validateCsrfToken: (sessionId: string, token: string) => token === `csrf:${sessionId}`
	}));
	const betterAuthModuleStub = {
		BETTER_AUTH_SESSION_COOKIE_NAME: 'gyre_session',
		clearBetterAuthSessionCookie: (cookies: {
			delete: (name: string, options: { path: string }) => void;
		}) => cookies.delete('gyre_session', { path: '/' }),
		getBetterAuthSessionCookieValue: (cookies: { get: (name: string) => string | undefined }) =>
			cookies.get('gyre_session'),
		applyBetterAuthCookies: () => {},
		createBetterAuthSessionForUser: async (
			cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void },
			userId: string
		) => {
			sessionLifecycleCalls.push(`create:${userId}`);
			cookies.set('gyre_session', 'new-session-cookie', { httpOnly: true, path: '/' });
			activeSession = {
				session: { id: 'session-new' },
				user: createUser()
			};
		},
		ensureBetterAuthOAuthAccount: async () => {},
		getBetterAuth: () => ({
			api: {
				signOut: async () => {
					signOutCalls += 1;
					return { headers: new Headers() };
				}
			}
		}),
		getBetterAuthSession: async (
			_request: Request,
			cookies: { get: (name: string) => string | undefined }
		) => {
			if (cookies.get('gyre_session') !== 'new-session-cookie') {
				return null;
			}
			return activeSession;
		},
		revokeBetterAuthSessionByCookieValue: async (cookieValue: string) => {
			sessionLifecycleCalls.push(`revoke:${cookieValue}`);
		}
	};
	mock.module('$lib/server/auth/better-auth', () => betterAuthModuleStub);
	mock.module('$lib/server/auth/better-auth.js', () => betterAuthModuleStub);
});

afterEach(() => {
	mock.restore();
});

describe('session cookie round trip behavior', () => {
	test('login, authenticated requests, and logout preserve the session-cookie flow', async () => {
		const loginModule = await importFresh<LoginRouteModule>(
			'../routes/api/v1/auth/login/+server.js'
		);
		const loginCookies = createCookies({ gyre_session: 'old-session-cookie' });

		const loginResponse = await loginModule.POST(
			buildLoginEvent({
				body: { username: ' Alice ', password: 'password123' },
				cookies: loginCookies
			})
		);

		expect(loginResponse.status).toBe(200);
		expect(await loginResponse.json()).toEqual({
			success: true,
			user: {
				id: 'user-1',
				username: 'alice',
				email: null,
				role: 'admin',
				requiresPasswordChange: false,
				canChangePassword: true
			}
		});
		expect(sessionLifecycleCalls.slice(0, 2)).toEqual([
			'revoke:old-session-cookie',
			'create:user-1'
		]);
		expect(loginCookies.get('gyre_session')).toBe('new-session-cookie');

		const { handle } = await importHooks();
		const followUpEvent = {
			cookies: loginCookies,
			getClientAddress: () => '127.0.0.1',
			locals: {} as App.Locals,
			request: new Request('http://localhost/api/v1/flux/version'),
			route: { id: '/api/v1/flux/version' },
			url: new URL('http://localhost/api/v1/flux/version')
		};

		const followUpResponse = await handle({
			event: followUpEvent,
			resolve: resolveTestRoute
		});

		expect(followUpResponse.status).toBe(200);
		expect(await followUpResponse.json()).toEqual({ version: 'v2.3.0' });
		expect(followUpEvent.locals.user?.id).toBe('user-1');
		expect(followUpEvent.locals.session?.id).toBe('session-new');
		expect(loginCookies.setCalls).toContainEqual({
			name: 'gyre_csrf',
			options: expect.objectContaining({ httpOnly: false, path: '/' }),
			value: 'csrf:session-new'
		});

		const logoutEvent = {
			cookies: loginCookies,
			getClientAddress: () => '127.0.0.1',
			locals: {} as App.Locals,
			request: new Request('http://localhost/api/v1/auth/logout', {
				headers: { 'x-csrf-token': 'csrf:session-new' },
				method: 'POST'
			}),
			route: { id: '/api/v1/auth/logout' },
			url: new URL('http://localhost/api/v1/auth/logout')
		};

		const logoutResponse = await handle({
			event: logoutEvent,
			resolve: resolveTestRoute
		});

		expect(logoutResponse.status).toBe(200);
		expect(await logoutResponse.json()).toEqual({ success: true });
		expect(signOutCalls).toBe(1);
		expect(loginCookies.deleted).toContainEqual({
			name: 'gyre_session',
			options: { path: '/' }
		});
	});
});
