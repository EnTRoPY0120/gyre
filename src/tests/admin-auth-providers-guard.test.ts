import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';

const permissionChecks: unknown[][] = [];

mock.module('$lib/server/rbac.js', () => ({
	checkPermission: async (...args: unknown[]) => {
		permissionChecks.push(args);
		return false;
	}
}));

import {
	GET as providersGET,
	POST as providersPOST
} from '../routes/api/v1/admin/auth-providers/+server.js';

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

beforeEach(() => {
	permissionChecks.length = 0;
});

describe('admin auth providers explicit in-handler guard', () => {
	test('GET rejects authenticated non-admin users with 403', async () => {
		await expect(
			providersGET({
				locals: { user: createUser('editor'), cluster: 'cluster-a' }
			} as Parameters<typeof providersGET>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Admin access required' }
		});

		expect(permissionChecks).toHaveLength(1);
		expect(permissionChecks[0][1]).toBe('admin');
		expect(permissionChecks[0][2]).toBe('AuthProvider');
	});

	test('POST rejects authenticated non-admin users with 403 before mutation', async () => {
		await expect(
			providersPOST({
				locals: { user: createUser('editor'), cluster: 'cluster-a' },
				setHeaders: () => {},
				request: new Request('http://localhost/api/v1/admin/auth-providers', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({})
				})
			} as Parameters<typeof providersPOST>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Admin access required' }
		});

		expect(permissionChecks).toHaveLength(1);
		expect(permissionChecks[0][1]).toBe('admin');
		expect(permissionChecks[0][2]).toBe('AuthProvider');
	});
});
