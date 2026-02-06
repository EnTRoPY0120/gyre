import { describe, it, expect, vi } from 'vitest';
import { checkPermission } from './rbac';
import type { User } from './db/schema';

// Mock the database module
vi.mock('./db/index.js', () => {
	const mockDb = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		get: vi.fn(),
		query: {
			rbacPolicies: {
				findFirst: vi.fn()
			}
		}
	};
	return {
		getDbSync: () => mockDb
	};
});

import { getDbSync } from './db/index.js';

describe('RBAC checkPermission', () => {
	const adminUser: User = {
		id: 'admin-id',
		username: 'admin',
		passwordHash: '',
		role: 'admin',
		active: true,
		isLocal: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		email: 'admin@local'
	};

	const viewerUser: User = {
		id: 'viewer-id',
		username: 'viewer',
		passwordHash: '',
		role: 'viewer',
		active: true,
		isLocal: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		email: 'viewer@local'
	};

	it('should allow admin role access to everything', async () => {
		const result = await checkPermission(adminUser, 'write', 'GitRepository');
		expect(result).toBe(true);
	});

	it('should deny viewer access when no policies are bound', async () => {
		const db = getDbSync() as any;
		// Mock the chain: db.select().from().where() -> resolves to []
		db.where.mockResolvedValueOnce([]);

		const result = await checkPermission(viewerUser, 'write', 'GitRepository');
		expect(result).toBe(false);
	});

	it('should handle policy matching correctly', async () => {
		const db = getDbSync() as any;

		// First call: mock user bindings (resolves to array)
		db.where.mockResolvedValueOnce([{ policyId: 'policy-1' }]);

		// Second call: mock policy check (resolves to object with count)
		// Chain: db.select().from().where().get() -> resolves to { count: 1 }
		db.get.mockResolvedValueOnce({ count: 1 });

		const result = await checkPermission(viewerUser, 'read', 'GitRepository');
		expect(result).toBe(true);
	});

	it('should deny access when policy count is 0', async () => {
		const db = getDbSync() as any;

		// First call: mock user bindings
		db.where.mockResolvedValueOnce([{ policyId: 'policy-1' }]);

		// Second call: mock policy check (count 0)
		db.get.mockResolvedValueOnce({ count: 0 });

		const result = await checkPermission(viewerUser, 'write', 'GitRepository');
		expect(result).toBe(false);
	});
});
