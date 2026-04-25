import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { buildLoginEvent, type LoginEvent } from './helpers/login-route-event';
import { createLoggerModuleStub, createRateLimiterModuleStub } from './helpers/module-stubs';

type LoginRouteModule = typeof import('../routes/api/v1/auth/login/+server.js');

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

let POST: LoginRouteModule['POST'];

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

function buildEvent(): LoginEvent {
	return buildLoginEvent();
}

beforeEach(async () => {
	Object.assign(routeState, createRouteState());

	mock.module('$lib/server/auth', () => ({
		SESSION_DURATION_DAYS: 30,
		addPasswordHistory: async () => {},
		authenticateUser: async () => routeState.authenticatedUser,
		clearRequiresPasswordChange: async () => {},
		cleanupSetupTokenFile: () => {},
		deleteUserSessions: async () => {},
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

	const auditModuleStub = {
		logAudit: async () => {},
		logLogin: async (user: User | null, success: boolean, ipAddress?: string, reason?: string) => {
			routeState.loginLogCalls.push({ user, success, ipAddress, reason });
		},
		logLogout: async () => {}
	};
	mock.module('$lib/server/audit', () => auditModuleStub);
	mock.module('$lib/server/audit.js', () => auditModuleStub);

	const betterAuthModuleStub = {
		BETTER_AUTH_SESSION_COOKIE_NAME: 'gyre_session',
		clearBetterAuthSessionCookie: (cookies: {
			delete: (name: string, options: { path: string }) => void;
		}) => cookies.delete('gyre_session', { path: '/' }),
		getBetterAuthSessionCookieValue: (cookies: { get: (name: string) => string | undefined }) =>
			cookies.get('gyre_session'),
		applyBetterAuthCookies: () => {},
		createBetterAuthSessionForUser: async () => {},
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

	mock.module('$lib/server/logger.js', () => createLoggerModuleStub());
	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);

	POST = (await importFresh<LoginRouteModule>('../routes/api/v1/auth/login/+server.js')).POST;
});

afterEach(() => {
	mock.restore();
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
