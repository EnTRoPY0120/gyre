import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { createLoggerModuleStub, createRateLimiterModuleStub } from './helpers/module-stubs';

type ChangePasswordRouteModule = typeof import('../routes/api/v1/auth/change-password/+server.js');
type ChangePasswordEvent = Parameters<ChangePasswordRouteModule['POST']>[0];

function createAuthState() {
	return {
		credentialAccount: { id: 'cred-1' } as { id: string } | null,
		credentialHash: 'stored-hash' as string | null,
		isInClusterAdmin: false,
		currentPasswordValid: true,
		newPasswordMatchesCurrent: false,
		passwordIsReused: false,
		events: [] as string[]
	};
}

const authState = createAuthState();

let POST: ChangePasswordRouteModule['POST'];

function createCookies(): Cookies {
	return {
		get: () => undefined,
		getAll: () => [],
		set: () => {},
		delete: () => {},
		serialize: () => ''
	};
}

function createUser(): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'admin',
		email: 'admin@gyre.local',
		name: 'admin',
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

function buildEvent(): ChangePasswordEvent {
	const request = new Request('http://localhost/api/v1/auth/change-password', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			currentPassword: 'CurrentPassword123!',
			newPassword: 'NewPassword123!'
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
			user: createUser(),
			session: null
		},
		params: {},
		platform: undefined,
		route: {
			id: '/api/v1/auth/change-password'
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
	} satisfies ChangePasswordEvent;
}

beforeEach(async () => {
	Object.assign(authState, createAuthState());

	vi.doMock('$lib/server/auth', () => ({
		SESSION_DURATION_DAYS: 30,
		addPasswordHistory: async () => {
			authState.events.push('history');
		},
		authenticateUser: async () => null,
		clearRequiresPasswordChange: async () => {
			authState.events.push('clear-password-change');
		},
		cleanupSetupTokenFile: () => {},
		deleteUserSessions: async () => {},
		getCredentialAccount: async () => authState.credentialAccount,
		getCredentialPasswordHash: async () => authState.credentialHash,
		getUserByUsername: async () => null,
		hasManagedPassword: async () => true,
		isInClusterAdmin: () => authState.isInClusterAdmin,
		isPasswordInHistory: async () => authState.passwordIsReused,
		normalizeUsername: (username: string) => username,
		verifyPassword: async (password: string) => {
			authState.events.push(`verify:${password}`);
			return password === 'CurrentPassword123!'
				? authState.currentPasswordValid
				: authState.newPasswordMatchesCurrent;
		}
	}));

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
				changePassword: async () => {
					authState.events.push('better-auth-change');
					return { headers: new Headers() };
				},
				signOut: async () => ({
					headers: new Headers()
				})
			}
		}),
		getBetterAuthSession: async () => null,
		revokeBetterAuthSessionByCookieValue: async () => {}
	};

	vi.doMock('$lib/server/auth/better-auth', () => betterAuthModuleStub);
	vi.doMock('$lib/server/auth/better-auth.js', () => betterAuthModuleStub);

	vi.doMock('$lib/server/logger.js', () => createLoggerModuleStub());
	vi.doMock('$lib/server/audit', () => ({
		logAudit: async (_user: User, event: string) => {
			authState.events.push(`audit:${event}`);
		}
	}));
	const rateLimiterModuleStub = createRateLimiterModuleStub();
	vi.doMock('$lib/server/rate-limiter', () => rateLimiterModuleStub);
	vi.doMock('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);

	POST = (
		await importFresh<ChangePasswordRouteModule>('../routes/api/v1/auth/change-password/+server.js')
	).POST;
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('change-password route credential handling', () => {
	test('records the old hash before rotation and clears the first-login flag after success', async () => {
		const response = await POST(buildEvent());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			message: 'Password changed successfully'
		});
		expect(authState.events).toEqual([
			'verify:CurrentPassword123!',
			'verify:NewPassword123!',
			'history',
			'better-auth-change',
			'audit:password_changed',
			'clear-password-change'
		]);
	});

	test('audits an invalid current password without rotating credentials', async () => {
		authState.currentPasswordValid = false;

		await expect(POST(buildEvent())).rejects.toMatchObject({
			status: 401,
			body: { message: 'Current password is incorrect' }
		});
		expect(authState.events).toEqual([
			'verify:CurrentPassword123!',
			'audit:password_change_failed'
		]);
	});

	test('returns actionable 500 when the credential account row is missing', async () => {
		authState.credentialAccount = null;
		authState.credentialHash = null;
		authState.isInClusterAdmin = false;

		await expect(POST(buildEvent())).rejects.toMatchObject({
			status: 500,
			body: {
				message:
					'Account configuration error: credential account missing for this user. Contact your administrator.'
			}
		});
	});

	test('returns 403 Kubernetes guidance when the in-cluster admin hash is unavailable', async () => {
		authState.credentialAccount = { id: 'cred-1' };
		authState.credentialHash = null;
		authState.isInClusterAdmin = true;

		await expect(POST(buildEvent())).rejects.toMatchObject({
			status: 403,
			body: {
				message:
					'The in-cluster admin password is managed via the Kubernetes secret "gyre-initial-admin-secret". Update the secret to rotate the password.'
			}
		});
	});

	test('returns actionable 500 when the credential hash is missing outside the cluster', async () => {
		authState.credentialAccount = { id: 'cred-1' };
		authState.credentialHash = null;
		authState.isInClusterAdmin = false;

		await expect(POST(buildEvent())).rejects.toMatchObject({
			status: 500,
			body: {
				message:
					'Account configuration error: credential password hash missing for this user. Contact your administrator.'
			}
		});
	});
});
