import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { createLoggerModuleStub, createRateLimiterModuleStub } from './helpers/module-stubs';

type CallbackRouteModule = typeof import('../routes/api/v1/auth/[providerId]/callback/+server.js');
type CallbackEvent = Parameters<CallbackRouteModule['GET']>[0];

function createCallbackState() {
	return {
		deletedCookies: [] as string[],
		sessionCreations: [] as Array<{ userId: string; ipAddress?: string; userAgent?: string }>
	};
}

const callbackState = createCallbackState();

let GET: CallbackRouteModule['GET'];

function createUser(): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'jane',
		email: 'jane@example.com',
		name: 'Jane Doe',
		emailVerified: true,
		image: null,
		role: 'viewer',
		active: true,
		isLocal: false,
		requiresPasswordChange: false,
		createdAt: now,
		updatedAt: now,
		preferences: null
	};
}

function createCookies(overrides: { stateCookie?: string; verifierCookie?: string } = {}): Cookies {
	return {
		get: (name: string) => {
			if (name === 'oauth_state_custom-provider') return overrides.stateCookie ?? 'state-123';
			if (name === 'oauth_verifier_custom-provider') {
				return overrides.verifierCookie ?? 'verifier-123';
			}
			return undefined;
		},
		getAll: () => [],
		set: () => {},
		delete: (name: string) => {
			callbackState.deletedCookies.push(name);
		},
		serialize: () => ''
	};
}

function buildEvent(
	overrides: { returnedState?: string | null; stateCookie?: string; verifierCookie?: string } = {}
): CallbackEvent {
	const searchParams = new URLSearchParams({ code: 'auth-code' });
	if (overrides.returnedState !== null) {
		searchParams.set('state', overrides.returnedState ?? 'state-123');
	}

	const request = new Request(
		`http://localhost/api/v1/auth/custom-provider/callback?${searchParams.toString()}`,
		{
			method: 'GET',
			headers: { 'user-agent': 'bun-test' }
		}
	);

	return {
		request,
		cookies: createCookies({
			stateCookie: overrides.stateCookie,
			verifierCookie: overrides.verifierCookie
		}),
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: {
			requestId: 'req-1',
			cluster: undefined,
			user: null,
			session: null
		},
		params: { providerId: 'custom-provider' },
		platform: undefined,
		route: {
			id: '/api/v1/auth/[providerId]/callback'
		},
		setHeaders: () => {},
		url: new URL(request.url),
		isDataRequest: false,
		isSubRequest: false,
		tracing: {
			enabled: false,
			root: trace.wrapSpanContext(INVALID_SPAN_CONTEXT),
			current: trace.wrapSpanContext(INVALID_SPAN_CONTEXT)
		},
		isRemoteRequest: false
	} satisfies CallbackEvent;
}

beforeEach(async () => {
	Object.assign(callbackState, createCallbackState());

	mock.module('$lib/server/auth/oauth', () => ({
		getOAuthProvider: async () => ({
			config: { id: 'custom-provider' },
			validateCallback: async () => ({ accessToken: 'access-token', tokenType: 'Bearer' }),
			getUserInfo: async () => ({
				sub: 'provider-user-1',
				preferred_username: 'jane',
				name: 'Jane Doe'
			})
		}),
		OAuthError: class OAuthError extends Error {
			constructor(
				message: string,
				public code: string,
				public details?: unknown
			) {
				super(message);
				this.name = 'OAuthError';
			}
		}
	}));

	mock.module('$lib/server/auth/sso', () => ({
		createOrUpdateSSOUser: async () => ({
			user: createUser(),
			accountLinked: true
		})
	}));

	mock.module('$lib/server/auth', () => ({
		SESSION_DURATION_DAYS: 30,
		addPasswordHistory: async () => {},
		authenticateUser: async () => null,
		clearRequiresPasswordChange: async () => {},
		cleanupSetupTokenFile: () => {},
		deleteUserSessions: async () => {},
		getCredentialAccount: async () => null,
		getCredentialPasswordHash: async () => null,
		getUserByUsername: async () => null,
		hasManagedPassword: async () => true,
		isInClusterAdmin: () => false,
		isPasswordInHistory: async () => false,
		normalizeUsername: (username: string) => username,
		verifyPassword: async () => true
	}));

	const betterAuthModuleStub = {
		BETTER_AUTH_SESSION_COOKIE_NAME: 'gyre_session',
		applyBetterAuthCookies: () => {},
		createBetterAuthSessionForUser: async (
			_cookies: Cookies,
			userId: string,
			details?: { ipAddress?: string; userAgent?: string }
		) => {
			callbackState.sessionCreations.push({ userId, ...details });
		},
		ensureBetterAuthOAuthAccount: async () => {},
		getBetterAuth: () => ({
			api: {
				changePassword: async () => ({ headers: new Headers() }),
				signOut: async () => ({ headers: new Headers() })
			}
		}),
		getBetterAuthSession: async () => null,
		revokeBetterAuthSessionByCookieValue: async () => {}
	};

	mock.module('$lib/server/auth/better-auth', () => betterAuthModuleStub);
	mock.module('$lib/server/auth/better-auth.js', () => betterAuthModuleStub);

	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);
	mock.module('$lib/server/logger.js', () => createLoggerModuleStub());

	GET = (
		await importFresh<CallbackRouteModule>('../routes/api/v1/auth/[providerId]/callback/+server.js')
	).GET;
});

afterEach(() => {
	mock.restore();
});

describe('oauth callback route', () => {
	test('accepts a raw state cookie without IP or user-agent fingerprinting', async () => {
		await expect(GET(buildEvent())).rejects.toMatchObject({
			status: 302,
			location: '/'
		});

		expect(callbackState.deletedCookies).toEqual([
			'oauth_state_custom-provider',
			'oauth_verifier_custom-provider'
		]);
		expect(callbackState.sessionCreations).toEqual([
			{ userId: 'user-1', ipAddress: '127.0.0.1', userAgent: 'bun-test' }
		]);
	});

	test('rejects mismatched state without creating a session', async () => {
		await expect(GET(buildEvent({ returnedState: 'wrong-state' }))).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'Invalid state parameter (possible CSRF attack)'
			}
		});

		expect(callbackState.sessionCreations).toEqual([]);
		expect(callbackState.deletedCookies).toEqual([]);
	});
});
