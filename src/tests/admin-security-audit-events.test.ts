import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';

const auditCalls: Array<[User | null, string, Record<string, unknown> | undefined]> = [];
const settingWrites: Array<[string, string]> = [];

let permissionAllowed = true;
let clearPoolCalls = 0;

const dbState: {
	insertedProviders: Array<Record<string, unknown>>;
	findFirstQueue: Array<Record<string, unknown> | null>;
	updates: Array<Record<string, unknown>>;
	deleteRuns: number;
} = {
	insertedProviders: [],
	findFirstQueue: [],
	updates: [],
	deleteRuns: 0
};

mock.module('$lib/server/audit', () => ({
	logAudit: async (user: User | null, action: string, options?: Record<string, unknown>) => {
		auditCalls.push([user, action, options]);
	}
}));

mock.module('$lib/server/rbac.js', () => ({
	checkPermission: async () => permissionAllowed
}));

mock.module('$lib/server/rbac', () => ({
	checkPermission: async () => permissionAllowed
}));

mock.module('$lib/server/rate-limiter', () => ({
	checkRateLimit: () => {}
}));

mock.module('$lib/server/db', () => ({
	getDb: async () => ({
		query: {
			authProviders: {
				findFirst: async () => {
					if (dbState.findFirstQueue.length > 0) {
						return dbState.findFirstQueue.shift() ?? null;
					}
					return dbState.insertedProviders[0] ?? null;
				}
			}
		},
		insert: () => ({
			values: async (value: Record<string, unknown>) => {
				dbState.insertedProviders.push({ ...value });
			}
		}),
		update: () => ({
			set: (updates: Record<string, unknown>) => ({
				where: async () => {
					dbState.updates.push({ ...updates });
					if (dbState.insertedProviders[0]) {
						dbState.insertedProviders[0] = {
							...dbState.insertedProviders[0],
							...updates
						};
					}
				}
			})
		}),
		transaction: async (
			fn: (tx: {
				delete: () => {
					where: () => {
						run: () => void;
					};
				};
			}) => void
		) => {
			fn({
				delete: () => ({
					where: () => ({
						run: () => {
							dbState.deleteRuns += 1;
						}
					})
				})
			});
		}
	})
}));

mock.module('$lib/auth/role-mapping', () => ({
	parseRoleMappingInput: (input: unknown) => {
		if (!input) return null;
		if (typeof input === 'object') return input;
		throw new Error('invalid role mapping');
	}
}));

mock.module('$lib/server/auth/role-mapping', () => ({
	parseRoleMappingSafe: (value: unknown) => {
		if (!value) return null;
		if (typeof value === 'string') {
			try {
				return JSON.parse(value);
			} catch {
				return null;
			}
		}
		return value;
	}
}));

mock.module('$lib/server/auth/oauth', () => ({
	validateProviderConfig: () => ({ valid: true, errors: [] })
}));

mock.module('$lib/server/auth/crypto', () => ({
	encryptSecret: (value: string) => `enc:${value}`
}));

mock.module('$lib/server/settings', () => ({
	SETTINGS_KEYS: {
		AUTH_LOCAL_LOGIN_ENABLED: 'auth.localLoginEnabled',
		AUTH_ALLOW_SIGNUP: 'auth.allowSignup',
		AUTH_DOMAIN_ALLOWLIST: 'auth.domainAllowlist',
		AUDIT_LOG_RETENTION_DAYS: 'audit.retentionDays'
	},
	setSetting: async (key: string, value: string) => {
		settingWrites.push([key, value]);
	},
	isSettingOverriddenByEnv: () => false,
	getAuthSettings: async () => ({
		localLoginEnabled: true,
		allowSignup: false,
		domainAllowlist: ['example.com']
	}),
	getAuditLogRetentionDays: async () => 90
}));

mock.module('$lib/server/kubernetes/client.js', () => ({
	clearClientPool: () => {
		clearPoolCalls += 1;
	}
}));

import { POST as createAuthProvider } from '../routes/api/v1/admin/auth-providers/+server.js';
import {
	PATCH as updateAuthProvider,
	DELETE as deleteAuthProvider
} from '../routes/api/v1/admin/auth-providers/[id]/+server.js';
import { PATCH as patchSettings } from '../routes/api/v1/admin/settings/+server.js';
import { POST as clearClientPool } from '../routes/api/v1/admin/k8s/clear-client-pool/+server.js';

function createUser(role: User['role'] = 'admin'): User {
	const now = new Date();
	return {
		id: 'admin-1',
		username: 'admin',
		email: null,
		name: 'Admin',
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

beforeEach(() => {
	auditCalls.length = 0;
	settingWrites.length = 0;
	permissionAllowed = true;
	clearPoolCalls = 0;
	dbState.insertedProviders.length = 0;
	dbState.findFirstQueue.length = 0;
	dbState.updates.length = 0;
	dbState.deleteRuns = 0;
});

describe('admin mutation audit events', () => {
	test('logs auth-provider:create on provider creation', async () => {
		const response = await createAuthProvider({
			locals: { user: createUser(), cluster: 'cluster-a' },
			setHeaders: () => {},
			request: new Request('http://localhost/api/v1/admin/auth-providers', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: 'Corp SSO',
					type: 'oidc',
					clientId: 'client-id',
					clientSecret: 'client-secret'
				})
			})
		} as Parameters<typeof createAuthProvider>[0]);

		expect(response.status).toBe(200);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0][1]).toBe('auth-provider:create');
		expect(auditCalls[0][2]?.resourceType).toBe('AuthProvider');
	});

	test('logs auth-provider:update on provider patch', async () => {
		dbState.findFirstQueue.push(
			{
				id: 'provider-1',
				name: 'Old Name',
				type: 'oidc',
				enabled: true,
				clientId: 'client-id',
				clientSecretEncrypted: 'enc:old',
				issuerUrl: null,
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
				scopes: 'openid profile email'
			},
			{
				id: 'provider-1',
				name: 'New Name',
				type: 'oidc',
				enabled: true,
				clientId: 'client-id',
				clientSecretEncrypted: 'enc:new',
				issuerUrl: null,
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
				scopes: 'openid profile email'
			}
		);

		const response = await updateAuthProvider({
			params: { id: 'provider-1' },
			locals: { user: createUser(), cluster: 'cluster-a' },
			request: new Request('http://localhost/api/v1/admin/auth-providers/provider-1', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: 'New Name', clientSecret: 'new-secret' })
			})
		} as Parameters<typeof updateAuthProvider>[0]);

		expect(response.status).toBe(200);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0][1]).toBe('auth-provider:update');
		expect(auditCalls[0][2]?.details).toEqual({
			providerId: 'provider-1',
			changedKeys: ['name'],
			clientSecretUpdated: true
		});
	});

	test('logs auth-provider:delete on provider deletion', async () => {
		dbState.findFirstQueue.push({
			id: 'provider-1',
			name: 'Delete Me',
			type: 'oidc'
		});

		const response = await deleteAuthProvider({
			params: { id: 'provider-1' },
			locals: { user: createUser(), cluster: 'cluster-a' }
		} as Parameters<typeof deleteAuthProvider>[0]);

		expect(response.status).toBe(200);
		expect(dbState.deleteRuns).toBe(2);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0][1]).toBe('auth-provider:delete');
		expect(auditCalls[0][2]?.resourceName).toBe('Delete Me');
	});

	test('logs settings:update with changed keys only', async () => {
		const response = await patchSettings({
			locals: { user: createUser(), cluster: 'cluster-a' },
			setHeaders: () => {},
			request: new Request('http://localhost/api/v1/admin/settings', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ allowSignup: false, domainAllowlist: ['Example.com'] })
			})
		} as Parameters<typeof patchSettings>[0]);

		expect(response.status).toBe(200);
		expect(settingWrites).toEqual([
			['auth.allowSignup', 'false'],
			['auth.domainAllowlist', '["example.com"]']
		]);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0][1]).toBe('settings:update');
		expect(auditCalls[0][2]?.details).toEqual({
			requestedKeys: ['allowSignup', 'domainAllowlist'],
			changedKeys: ['auth.allowSignup', 'auth.domainAllowlist']
		});
	});

	test('logs k8s-client-pool:clear on pool clear mutation', async () => {
		const response = await clearClientPool({
			locals: { user: createUser(), cluster: 'cluster-a' }
		} as Parameters<typeof clearClientPool>[0]);

		expect(response.status).toBe(200);
		expect(clearPoolCalls).toBe(1);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0][1]).toBe('k8s-client-pool:clear');
	});
});
