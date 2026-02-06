import { describe, it, expect, vi, type Mock } from 'vitest';
import { checkPermission } from './rbac';
import type { User } from './db/schema';

// Define a type for our mock database to satisfy the linter
interface MockDb {
	select: Mock;
	from: Mock;
	where: Mock;
	get: Mock;
	query: {
		rbacPolicies: {
			findFirst: Mock;
		};
	};
}

const mockDb: MockDb = {
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

// Mock the database module
vi.mock('./db/index.js', () => ({
	getDbSync: () => mockDb
}));

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
		// Mock the chain: db.select().from().where() -> resolves to []
		mockDb.where.mockResolvedValueOnce([]);

		const result = await checkPermission(viewerUser, 'write', 'GitRepository');
		expect(result).toBe(false);
	});

	it('should handle policy matching correctly', async () => {
		// First call: mock user bindings (resolves to array)
		mockDb.where.mockResolvedValueOnce([{ policyId: 'policy-1' }]);

		// Second call: mock policy check (resolves to object with count)
		// Chain: db.select().from().where().get() -> resolves to { count: 1 }
		mockDb.get.mockResolvedValueOnce({ count: 1 });

		const result = await checkPermission(viewerUser, 'read', 'GitRepository');
		expect(result).toBe(true);
	});

	it('should deny access when policy count is 0', async () => {
		// First call: mock user bindings
		mockDb.where.mockResolvedValueOnce([{ policyId: 'policy-1' }]);

		// Second call: mock policy check (count 0)
		mockDb.get.mockResolvedValueOnce({ count: 0 });

		const result = await checkPermission(viewerUser, 'write', 'GitRepository');
		expect(result).toBe(false);
	});
});
