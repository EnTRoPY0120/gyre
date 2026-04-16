import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { importFresh } from './helpers/import-fresh';
import { createAuthCryptoModuleStub, createLoggerModuleStub } from './helpers/module-stubs';

type SSOModule = typeof import('../lib/server/auth/sso.js');

function flattenSqlParts(value: unknown): string[] {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return [String(value)];
	}

	if (Array.isArray(value)) {
		return value.flatMap((entry) => flattenSqlParts(entry));
	}

	if (!value || typeof value !== 'object') {
		return [];
	}

	if ('queryChunks' in value && Array.isArray(value.queryChunks)) {
		return value.queryChunks.flatMap((chunk) => flattenSqlParts(chunk));
	}

	if ('name' in value && typeof value.name === 'string') {
		return [`column:${value.name}`];
	}

	if ('value' in value) {
		return flattenSqlParts(value.value);
	}

	return [];
}

function whereParts(args: { where?: unknown } | undefined): string[] {
	return flattenSqlParts(args?.where);
}

function createDbState() {
	return {
		existingLink: null as { userId: string } | null,
		userLookups: [] as Array<unknown>,
		disabledUserByUsername: { id: 'user-disabled', active: false } as Record<
			string,
			unknown
		> | null,
		disabledUserByEmail: null as Record<string, unknown> | null,
		accountFindFirstArgs: [] as Array<unknown>,
		userFindFirstArgs: [] as Array<unknown>,
		updatedUserSets: [] as Array<Record<string, unknown>>
	};
}

const dbState = createDbState();
let createOrUpdateSSOUser: SSOModule['createOrUpdateSSOUser'];

function createProviderConfig(emailClaim = 'email') {
	return {
		id: 'oidc-provider',
		name: 'OIDC',
		type: 'oidc' as const,
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
		emailClaim,
		usePkce: true,
		scopes: 'openid profile email',
		createdAt: new Date(),
		updatedAt: new Date()
	};
}

beforeEach(async () => {
	Object.assign(dbState, createDbState());

	mock.module('$lib/server/db', () => ({
		getDb: async () => ({
			query: {
				accounts: {
					findFirst: async (args: unknown) => {
						dbState.accountFindFirstArgs.push(args);
						return dbState.existingLink;
					}
				},
				users: {
					findFirst: async (args: { where?: unknown } | undefined) => {
						dbState.userFindFirstArgs.push(args);

						const nextLookup = dbState.userLookups.shift();
						if (nextLookup !== undefined) {
							return nextLookup;
						}

						const parts = whereParts(args);

						if (
							dbState.disabledUserByUsername &&
							parts.includes('column:username') &&
							parts.includes('disabled-user') &&
							parts.includes('column:active') &&
							parts.includes('false')
						) {
							const match = dbState.disabledUserByUsername;
							dbState.disabledUserByUsername = null;
							return match;
						}

						if (
							dbState.disabledUserByEmail &&
							parts.includes('column:email') &&
							parts.includes('lower(') &&
							parts.includes('disabled@example.com') &&
							parts.includes('column:active') &&
							parts.includes('false')
						) {
							const match = dbState.disabledUserByEmail;
							dbState.disabledUserByEmail = null;
							return match;
						}

						return null;
					}
				}
			},
			update: () => ({
				set: (values: Record<string, unknown>) => {
					dbState.updatedUserSets.push(values);
					return {
						where: async () => {}
					};
				}
			})
		})
	}));

	mock.module('$lib/server/auth', () => ({
		generateUserId: () => 'generated-user-id',
		normalizeUsername: (username: string) => username.toLowerCase().trim(),
		updateUser: async () => null,
		deleteUserSessions: async () => {}
	}));

	mock.module('../lib/server/rbac-defaults.js', () => ({
		bindUserToDefaultPolicies: async () => {}
	}));

	mock.module('../lib/server/auth/crypto.js', () => createAuthCryptoModuleStub());

	mock.module('../lib/server/settings.js', () => ({
		getAuthSettings: async () => ({
			allowSignup: true,
			localLoginEnabled: true,
			domainAllowlist: []
		})
	}));

	mock.module('../lib/server/logger.js', () => createLoggerModuleStub());

	createOrUpdateSSOUser = (await importFresh<SSOModule>('../lib/server/auth/sso.js'))
		.createOrUpdateSSOUser;
});

afterEach(() => {
	mock.restore();
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
			createProviderConfig()
		);

		expect(result).toEqual({ user: null, reason: 'user_disabled' });
	});

	test('blocks auto-provision when a disabled email match exists with different casing', async () => {
		dbState.disabledUserByUsername = null;
		dbState.disabledUserByEmail = {
			id: 'user-disabled-email',
			active: false,
			email: 'disabled@example.com'
		};

		const result = await createOrUpdateSSOUser(
			'oidc-provider',
			{
				sub: 'oidc-user-2',
				email: 'Disabled@Example.com',
				preferred_username: 'another-user',
				name: 'Disabled Email User'
			},
			createProviderConfig()
		);

		expect(result).toEqual({ user: null, reason: 'user_disabled' });
		expect(whereParts(dbState.userFindFirstArgs[1] as { where?: unknown })).toEqual(
			expect.arrayContaining(['column:email', 'lower(', 'disabled@example.com', 'column:active'])
		);
	});

	test('preserves a verified email when an existing SSO user logs in without an IdP email', async () => {
		dbState.existingLink = { userId: 'existing-user-id' };
		dbState.userLookups = [
			{
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'verified@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: true
			}
		];

		const result = await createOrUpdateSSOUser(
			'oidc-provider',
			{
				sub: 'oidc-user-3',
				preferred_username: 'existing-user',
				name: 'Existing User'
			},
			createProviderConfig()
		);

		expect(result).toEqual({
			user: {
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'verified@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: true
			}
		});
		expect(dbState.updatedUserSets).toHaveLength(0);
	});

	test('does not verify an existing email when the IdP omits the email claim', async () => {
		dbState.existingLink = { userId: 'existing-user-id' };
		dbState.userLookups = [
			{
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'verified@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: false
			}
		];

		const result = await createOrUpdateSSOUser(
			'oidc-provider',
			{
				sub: 'oidc-user-3a',
				preferred_username: 'existing-user',
				name: 'Existing User',
				emailVerified: true
			},
			createProviderConfig('missing.email')
		);

		expect(result).toEqual({
			user: {
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'verified@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: false
			}
		});
		expect(dbState.updatedUserSets.some((values) => values.emailVerified === true)).toBeFalse();
	});

	test('canonicalizes configured email claims before validating and saving them', async () => {
		dbState.existingLink = { userId: 'existing-user-id' };
		dbState.userLookups = [
			{
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'old@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: true
			},
			{
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'disabled@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: false
			}
		];

		await createOrUpdateSSOUser(
			'oidc-provider',
			{
				sub: 'oidc-user-4',
				preferred_username: 'existing-user',
				name: 'Existing User',
				profile: { email: ' Disabled@Example.com ' }
			},
			createProviderConfig('profile.email')
		);

		expect(dbState.updatedUserSets).toHaveLength(1);
		expect(dbState.updatedUserSets[0]).toEqual(
			expect.objectContaining({ email: 'disabled@example.com', emailVerified: false })
		);
	});

	test('canonicalizes fallback userInfo.email before validating and saving it', async () => {
		dbState.existingLink = { userId: 'existing-user-id' };
		dbState.userLookups = [
			{
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'old@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: true
			},
			{
				id: 'existing-user-id',
				username: 'existing-user',
				email: 'fallback@example.com',
				name: 'Existing User',
				image: null,
				role: 'viewer',
				active: true,
				isLocal: false,
				emailVerified: false
			}
		];

		await createOrUpdateSSOUser(
			'oidc-provider',
			{
				sub: 'oidc-user-5',
				preferred_username: 'existing-user',
				name: 'Existing User',
				email: ' Fallback@Example.com '
			},
			createProviderConfig('missing.email')
		);

		expect(dbState.updatedUserSets).toHaveLength(1);
		expect(dbState.updatedUserSets[0]).toEqual(
			expect.objectContaining({ email: 'fallback@example.com', emailVerified: false })
		);
	});
});
