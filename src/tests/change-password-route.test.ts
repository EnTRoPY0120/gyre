import { describe, test, expect, mock } from 'bun:test';

const authState = {
	credentialAccount: { id: 'cred-1' } as { id: string } | null,
	credentialHash: 'stored-hash' as string | null,
	isInClusterAdmin: false
};

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
		error: () => {}
	}
}));

mock.module('$lib/server/audit', () => ({
	logAudit: async () => {}
}));

mock.module('$lib/server/rate-limiter', () => ({
	checkRateLimit: () => {}
}));

import { POST } from '../routes/api/v1/auth/change-password/+server.js';

function buildEvent() {
	return {
		request: new Request('http://localhost/api/v1/auth/change-password', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				currentPassword: 'CurrentPassword123!',
				newPassword: 'NewPassword123!'
			})
		}),
		locals: {
			user: {
				id: 'user-1',
				username: 'admin',
				isLocal: true
			},
			session: null
		},
		setHeaders: () => {},
		cookies: {}
	};
}

describe('change-password route credential handling', () => {
	test('returns actionable 500 when the credential account row is missing', async () => {
		authState.credentialAccount = null;
		authState.credentialHash = null;
		authState.isInClusterAdmin = false;

		await expect(POST(buildEvent() as never)).rejects.toMatchObject({
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

		await expect(POST(buildEvent() as never)).rejects.toMatchObject({
			status: 403,
			body: {
				message:
					'The in-cluster admin password is managed via the Kubernetes secret "gyre-initial-admin-secret". Update the secret to rotate the password.'
			}
		});
	});
});
