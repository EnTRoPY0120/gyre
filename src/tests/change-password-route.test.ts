import { describe, test, expect, mock, afterAll, beforeEach } from 'bun:test';
import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import type { Cookies } from '@sveltejs/kit';
import type { User } from '../lib/server/db/schema.js';

function createAuthState() {
	return {
		credentialAccount: { id: 'cred-1' } as { id: string } | null,
		credentialHash: 'stored-hash' as string | null,
		isInClusterAdmin: false
	};
}

const authState = createAuthState();

mock.module('$lib/server/auth', () => ({
	addPasswordHistory: async () => {},
	getCredentialAccount: async () => authState.credentialAccount,
	getCredentialPasswordHash: async () => authState.credentialHash,
	isInClusterAdmin: () => authState.isInClusterAdmin,
	isPasswordInHistory: async () => false,
	verifyPassword: async () => true
}));

mock.module('$lib/server/auth/better-auth', () => ({
	applyBetterAuthCookies: () => {},
	getBetterAuth: () => ({
		api: {
			changePassword: async () => ({
				headers: new Headers()
			})
		}
	})
}));

mock.module('$lib/server/logger.js', () => ({
	logger: {
		error: () => {},
		warn: () => {},
		info: () => {},
		debug: () => {}
	}
}));

mock.module('$lib/server/audit', () => ({
	logAudit: async () => {}
}));

mock.module('$lib/server/rate-limiter', () => ({
	checkRateLimit: () => {}
}));

import { POST } from '../routes/api/v1/auth/change-password/+server.js';

mock.restore();

afterAll(() => {
	mock.restore();
});

type ChangePasswordEvent = Parameters<typeof POST>[0];

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
	const event = {
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

	return event;
}

beforeEach(() => {
	Object.assign(authState, createAuthState());
});

describe('change-password route credential handling', () => {
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
});
