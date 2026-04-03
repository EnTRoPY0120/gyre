import { beforeEach, describe, expect, mock, test } from 'bun:test';

function createDbState() {
	return {
		existingLink: null as { userId: string } | null,
		userLookups: [] as Array<unknown>,
		disabledUserByUsername: { id: 'user-disabled', active: false } as Record<
			string,
			unknown
		> | null,
		disabledUserByEmail: null as Record<string, unknown> | null
	};
}

const dbState = createDbState();

mock.module('$lib/server/db', () => ({
	getDb: async () => ({
		query: {
			accounts: {
				findFirst: async () => dbState.existingLink
			},
			users: {
				findFirst: async () => {
					const nextLookup = dbState.userLookups.shift();
					if (nextLookup !== undefined) {
						return nextLookup;
					}
					if (dbState.disabledUserByUsername) {
						const match = dbState.disabledUserByUsername;
						dbState.disabledUserByUsername = null;
						return match;
					}
					if (dbState.disabledUserByEmail) {
						const match = dbState.disabledUserByEmail;
						dbState.disabledUserByEmail = null;
						return match;
					}
					return null;
				}
			}
		}
	})
}));

mock.module('$lib/server/auth', () => ({
	generateUserId: () => 'generated-user-id',
	normalizeUsername: (username: string) => username.toLowerCase().trim(),
	updateUser: async () => null,
	deleteUserSessions: async () => {}
}));

mock.module('$lib/server/rbac-defaults.js', () => ({
	bindUserToDefaultPolicies: async () => {}
}));

mock.module('$lib/server/auth/crypto.js', () => ({
	encryptSecret: (value: string) => `encrypted:${value}`
}));

mock.module('$lib/server/settings.js', () => ({
	getAuthSettings: async () => ({
		allowSignup: true,
		localLoginEnabled: true,
		domainAllowlist: []
	})
}));

mock.module('$lib/server/logger.js', () => ({
	logger: {
		warn: () => {},
		info: () => {},
		error: () => {}
	}
}));

import { createOrUpdateSSOUser } from '../lib/server/auth/sso.js';

beforeEach(() => {
	Object.assign(dbState, createDbState());
});

describe('SSO auto provisioning', () => {
	test('blocks auto-provision when a disabled username match already exists', async () => {
		const result = await createOrUpdateSSOUser(
			'oidc-provider',
			{
				sub: 'oidc-user-1',
				email: 'disabled@example.com',
				preferred_username: 'disabled-user',
				name: 'Disabled User'
			},
			{
				id: 'oidc-provider',
				name: 'OIDC',
				type: 'oidc',
				enabled: true,
				clientId: 'client-id',
				clientSecretEncrypted: 'secret',
				issuerUrl: 'https://issuer.example.com',
				authorizationUrl: null,
				tokenUrl: null,
				userInfoUrl: null,
				jwksUrl: null,
				autoProvision: true,
				defaultRole: 'viewer',
				roleMapping: null,
				roleClaim: 'groups',
				usernameClaim: 'preferred_username',
				emailClaim: 'email',
				usePkce: true,
				scopes: 'openid profile email',
				createdAt: new Date(),
				updatedAt: new Date()
			}
		);

		expect(result).toEqual({ user: null, reason: 'user_disabled' });
	});
});
