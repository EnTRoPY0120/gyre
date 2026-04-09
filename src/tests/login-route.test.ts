import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '../lib/server/db/schema.js';

function createRouteState() {
	const activeUser = createUser({ active: true });
	return {
		localLoginEnabled: true,
		existingUser: activeUser as User | null,
		authenticatedUser: activeUser as User | null,
		canChangePassword: true,
		verifyPasswordCalls: [] as Array<{ password: string; hash: string }>,
		loginLogCalls: [] as Array<{
			user: User | null;
			success: boolean;
			ipAddress?: string;
			reason?: string;
		}>
	};
}

const routeState = createRouteState();

mock.module('$lib/server/auth', () => ({
	addPasswordHistory: async () => {},
	authenticateUser: async () => routeState.authenticatedUser,
	clearRequiresPasswordChange: async () => {},
	getCredentialAccount: async () => null,
	getCredentialPasswordHash: async () => null,
	getUserByUsername: async () => routeState.existingUser,
	hasManagedPassword: async () => routeState.canChangePassword,
	isInClusterAdmin: () => false,
	isPasswordInHistory: async () => false,
	normalizeUsername: (username: string) => username.toLowerCase().trim(),
	hashPassword: async () => '$2b$12$0123456789abcdefghijklmu4rjCjM1rUuK2mQsjm9nO0LQ4pQeW2',
	verifyPassword: async (password: string, hash: string) => {
		routeState.verifyPasswordCalls.push({ password, hash });
		return false;
	}
}));

mock.module('$lib/server/auth.js', () => ({
	addPasswordHistory: async () => {},
	authenticateUser: async () => routeState.authenticatedUser,
	clearRequiresPasswordChange: async () => {},
	getCredentialAccount: async () => null,
	getCredentialPasswordHash: async () => null,
	getUserByUsername: async () => routeState.existingUser,
	hasManagedPassword: async () => routeState.canChangePassword,
	isInClusterAdmin: () => false,
	isPasswordInHistory: async () => false,
	normalizeUsername: (username: string) => username.toLowerCase().trim(),
	hashPassword: async () => '$2b$12$0123456789abcdefghijklmu4rjCjM1rUuK2mQsjm9nO0LQ4pQeW2',
	verifyPassword: async (password: string, hash: string) => {
		routeState.verifyPasswordCalls.push({ password, hash });
		return false;
	}
}));

mock.module('$lib/server/auth.ts', () => ({
	addPasswordHistory: async () => {},
	authenticateUser: async () => routeState.authenticatedUser,
	clearRequiresPasswordChange: async () => {},
	getCredentialAccount: async () => null,
	getCredentialPasswordHash: async () => null,
	getUserByUsername: async () => routeState.existingUser,
	hasManagedPassword: async () => routeState.canChangePassword,
	isInClusterAdmin: () => false,
	isPasswordInHistory: async () => false,
	normalizeUsername: (username: string) => username.toLowerCase().trim(),
	hashPassword: async () => '$2b$12$0123456789abcdefghijklmu4rjCjM1rUuK2mQsjm9nO0LQ4pQeW2',
	verifyPassword: async (password: string, hash: string) => {
		routeState.verifyPasswordCalls.push({ password, hash });
		return false;
	}
}));

mock.module('$lib/server/settings', () => ({
	getAuthSettings: async () => ({
		localLoginEnabled: routeState.localLoginEnabled,
		allowSignup: true,
		domainAllowlist: []
	})
}));

mock.module('$lib/server/audit', () => ({
	logAudit: async () => {},
	logResourceWrite: async () => {},
	logLogin: async (user: User | null, success: boolean, ipAddress?: string, reason?: string) => {
		routeState.loginLogCalls.push({ user, success, ipAddress, reason });
	}
}));

mock.module('$lib/server/audit.js', () => ({
	logAudit: async () => {},
	logResourceWrite: async () => {},
	logLogin: async (user: User | null, success: boolean, ipAddress?: string, reason?: string) => {
		routeState.loginLogCalls.push({ user, success, ipAddress, reason });
	}
}));

mock.module('$lib/server/auth/better-auth', () => ({
	BETTER_AUTH_SESSION_COOKIE_NAME: 'better-auth.session_token',
	applyBetterAuthCookies: () => {},
	createBetterAuthSessionForUser: async () => {},
	getBetterAuth: () => ({
		api: {
			changePassword: async () => ({
				headers: new Headers()
			})
		}
	}),
	revokeBetterAuthSessionByCookieValue: async () => {}
}));

mock.module('$lib/server/auth/better-auth.js', () => ({
	BETTER_AUTH_SESSION_COOKIE_NAME: 'better-auth.session_token',
	applyBetterAuthCookies: () => {},
	createBetterAuthSessionForUser: async () => {},
	getBetterAuth: () => ({
		api: {
			changePassword: async () => ({
				headers: new Headers()
			})
		}
	}),
	revokeBetterAuthSessionByCookieValue: async () => {}
}));

mock.module('$lib/server/auth/better-auth.ts', () => ({
	BETTER_AUTH_SESSION_COOKIE_NAME: 'better-auth.session_token',
	applyBetterAuthCookies: () => {},
	createBetterAuthSessionForUser: async () => {},
	getBetterAuth: () => ({
		api: {
			changePassword: async () => ({
				headers: new Headers()
			})
		}
	}),
	revokeBetterAuthSessionByCookieValue: async () => {}
}));

mock.module('$lib/server/logger.js', () => ({
	logger: {
		error: () => {},
		warn: () => {},
		info: () => {},
		debug: () => {}
	}
}));

mock.module('$lib/server/rate-limiter', () => ({
	checkRateLimit: () => {},
	accountLockout: {
		check: () => ({ locked: false, retryAfter: 0 }),
		recordFailure: () => {},
		recordSuccess: () => {}
	}
}));

const { POST } =
	(await import('../routes/api/v1/auth/login/+server.js?test=login-route')) as typeof import('../routes/api/v1/auth/login/+server.js');
mock.restore();

type LoginEvent = Parameters<typeof POST>[0];

function createUser(overrides: Partial<User> = {}): User {
	const now = new Date();
	return {
		id: overrides.id ?? 'user-1',
		username: overrides.username ?? 'admin',
		email: overrides.email ?? 'admin@gyre.local',
		name: overrides.name ?? 'admin',
		emailVerified: overrides.emailVerified ?? false,
		image: overrides.image ?? null,
		role: overrides.role ?? 'admin',
		active: overrides.active ?? true,
		isLocal: overrides.isLocal ?? true,
		requiresPasswordChange: overrides.requiresPasswordChange ?? false,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
		preferences: overrides.preferences ?? null
	};
}

function createCookies(): Cookies {
	return {
		get: () => undefined,
		getAll: () => [],
		set: () => {},
		delete: () => {},
		serialize: () => ''
	};
}

function buildEvent(): LoginEvent {
	const request = new Request('http://localhost/api/v1/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			username: 'admin',
			password: 'Password123!'
		})
	});

	return {
		request,
		cookies: createCookies(),
		fetch,
		getClientAddress: () => '127.0.0.1',
		locals: {
			requestId: 'req-1',
			cluster: undefined,
			user: null,
			session: null
		},
		params: {},
		platform: undefined,
		route: {
			id: '/api/v1/auth/login'
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
	} satisfies LoginEvent;
}

beforeEach(() => {
	Object.assign(routeState, createRouteState());
});

describe('login route', () => {
	test('rejects local login when the setting is disabled', async () => {
		routeState.localLoginEnabled = false;

		await expect(POST(buildEvent())).rejects.toMatchObject({
			status: 403,
			body: {
				message: 'Local username/password sign-in is disabled.'
			}
		});
	});

	test('allows local login without cluster context', async () => {
		const response = await POST(buildEvent());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.user.username).toBe('admin');
		expect(body.user.canChangePassword).toBe(true);
	});

	test('returns canChangePassword=true for local first-login accounts', async () => {
		routeState.authenticatedUser = createUser({ requiresPasswordChange: true });

		const response = await POST(buildEvent());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.user.requiresPasswordChange).toBe(true);
		expect(body.user.canChangePassword).toBe(true);
	});

	test('returns canChangePassword=false for managed-password accounts', async () => {
		routeState.canChangePassword = false;
		routeState.authenticatedUser = createUser({ requiresPasswordChange: true });

		const response = await POST(buildEvent());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.user.requiresPasswordChange).toBe(true);
		expect(body.user.canChangePassword).toBe(false);
	});

	test('returns a generic invalid-credentials error for disabled accounts', async () => {
		routeState.existingUser = createUser({ active: false });
		routeState.authenticatedUser = null;

		await expect(POST(buildEvent())).rejects.toMatchObject({
			status: 401,
			body: {
				message: 'Invalid username or password'
			}
		});

		expect(routeState.verifyPasswordCalls).toHaveLength(1);
		expect(routeState.verifyPasswordCalls[0]?.password).toBe('Password123!');
		expect(routeState.verifyPasswordCalls[0]?.hash).toMatch(/^\$2[aby]\$/);
		expect(routeState.loginLogCalls).toEqual([
			{
				user: routeState.existingUser,
				success: false,
				ipAddress: '127.0.0.1',
				reason: 'account_disabled'
			}
		]);
	});
});
