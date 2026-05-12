import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { createRbacModuleStub } from './helpers/module-stubs';

type AuthProvidersRouteModule = typeof import('../routes/api/v1/admin/auth-providers/+server.js');

const permissionChecks: unknown[][] = [];

let providersGET: AuthProvidersRouteModule['GET'];
let providersPOST: AuthProvidersRouteModule['POST'];

function createUser(role: User['role'] = 'editor'): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'editor',
		email: null,
		name: 'Editor',
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

beforeEach(async () => {
	permissionChecks.length = 0;

	vi.doMock('$lib/server/rbac.js', () =>
		createRbacModuleStub({
			checkPermission: async (...args: unknown[]) => {
				permissionChecks.push(args);
				return false;
			}
		})
	);

	const routeModule = await importFresh<AuthProvidersRouteModule>(
		'../routes/api/v1/admin/auth-providers/+server.js'
	);
	providersGET = routeModule.GET;
	providersPOST = routeModule.POST;
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('admin auth providers explicit in-handler guard', () => {
	test('GET rejects authenticated non-admin users with 403', async () => {
		const locals = { user: createUser('editor'), cluster: 'cluster-a' };
		await expect(
			providersGET({
				locals
			} as Parameters<AuthProvidersRouteModule['GET']>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Admin access required' }
		});

		expect(permissionChecks).toHaveLength(1);
		expect(permissionChecks[0][1]).toBe('admin');
		expect(permissionChecks[0][2]).toBe('AuthProvider');
		expect(permissionChecks[0][4]).toBe(locals.cluster);
	});

	test('POST rejects authenticated non-admin users with 403 before mutation', async () => {
		const locals = { user: createUser('editor'), cluster: 'cluster-a' };
		await expect(
			providersPOST({
				locals,
				setHeaders: () => {},
				request: new Request('http://localhost/api/v1/admin/auth-providers', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({})
				})
			} as Parameters<AuthProvidersRouteModule['POST']>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Admin access required' }
		});

		expect(permissionChecks).toHaveLength(1);
		expect(permissionChecks[0][1]).toBe('admin');
		expect(permissionChecks[0][2]).toBe('AuthProvider');
		expect(permissionChecks[0][4]).toBe(locals.cluster);
	});
});
