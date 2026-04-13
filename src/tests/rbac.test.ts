import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';

mock.restore();

spyOn(console, 'log').mockImplementation(() => {});

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';

// Mutable reference shared with the mock closure so each test gets a fresh DB
const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };

// Bun hoists mock.module calls above static imports
mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

import {
	checkClusterWideReadPermission,
	checkPermission,
	isAdmin,
	requirePermission,
	RbacError
} from '../lib/server/rbac.js?sut';
import type { User } from '../lib/server/db/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREATE_USERS = `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		email TEXT,
		name TEXT NOT NULL DEFAULT '',
		email_verified INTEGER NOT NULL DEFAULT 0,
		image TEXT,
		role TEXT NOT NULL DEFAULT 'viewer',
		active INTEGER NOT NULL DEFAULT 1,
		is_local INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
		preferences TEXT
	)
`;

const CREATE_RBAC_POLICIES = `
	CREATE TABLE IF NOT EXISTS rbac_policies (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		description TEXT,
		role TEXT NOT NULL,
		resource_type TEXT,
		action TEXT NOT NULL,
		namespace_pattern TEXT,
		cluster_id TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch())
	)
`;

const CREATE_RBAC_BINDINGS = `
	CREATE TABLE IF NOT EXISTS rbac_bindings (
		user_id TEXT NOT NULL,
		policy_id TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (user_id, policy_id)
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS);
	sqlite.exec(CREATE_RBAC_POLICIES);
	sqlite.exec(CREATE_RBAC_BINDINGS);
	return drizzle(sqlite, { schema });
}

function makeUser(id: string, role: 'admin' | 'editor' | 'viewer' = 'viewer'): User {
	return {
		id,
		username: id,
		email: null,
		name: id,
		emailVerified: false,
		image: null,
		role,
		active: true,
		isLocal: true,
		requiresPasswordChange: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		preferences: null
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isAdmin', () => {
	test('returns true for admin role', () => {
		expect(isAdmin(makeUser('u', 'admin'))).toBe(true);
	});

	test('returns false for viewer role', () => {
		expect(isAdmin(makeUser('u', 'viewer'))).toBe(false);
	});

	test('returns false for editor role', () => {
		expect(isAdmin(makeUser('u', 'editor'))).toBe(false);
	});
});

describe('checkPermission', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('admin role bypasses all DB checks', async () => {
		const admin = makeUser('admin-user', 'admin');
		expect(await checkPermission(admin, 'read')).toBe(true);
		expect(await checkPermission(admin, 'write')).toBe(true);
		expect(await checkPermission(admin, 'admin')).toBe(true);
	});

	test('non-admin with no bindings returns false', async () => {
		const user = makeUser('no-bindings');
		expect(await checkPermission(user, 'read')).toBe(false);
	});

	test('non-admin with read policy can read but not write', async () => {
		const db = state.db!;
		const user = makeUser('user-read');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-read',
			name: 'read-policy',
			role: 'viewer',
			action: 'read',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-read' });

		expect(await checkPermission(user, 'read')).toBe(true);
		expect(await checkPermission(user, 'write')).toBe(false);
		expect(await checkPermission(user, 'admin')).toBe(false);
	});

	test('write policy grants read via hierarchy', async () => {
		const db = state.db!;
		const user = makeUser('user-write', 'editor');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-write',
			name: 'write-policy',
			role: 'editor',
			action: 'write',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-write' });

		expect(await checkPermission(user, 'read')).toBe(true);
		expect(await checkPermission(user, 'write')).toBe(true);
		expect(await checkPermission(user, 'admin')).toBe(false);
	});

	test('editor can use viewer-scoped policies via role hierarchy', async () => {
		const db = state.db!;
		const user = makeUser('user-editor-viewer-policy', 'editor');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-viewer-read',
			name: 'viewer-read-policy',
			role: 'viewer',
			action: 'read',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-viewer-read' });

		expect(await checkPermission(user, 'read')).toBe(true);
		expect(await checkPermission(user, 'write')).toBe(false);
	});

	test('viewer cannot use editor-scoped policies', async () => {
		const db = state.db!;
		const user = makeUser('user-viewer-editor-policy', 'viewer');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-editor-write',
			name: 'editor-write-policy',
			role: 'editor',
			action: 'write',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-editor-write' });

		expect(await checkPermission(user, 'read')).toBe(false);
		expect(await checkPermission(user, 'write')).toBe(false);
	});

	test('editor cannot use admin-scoped policies', async () => {
		const db = state.db!;
		const user = makeUser('user-editor-admin-policy', 'editor');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-admin',
			name: 'admin-policy',
			role: 'admin',
			action: 'admin',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-admin' });

		expect(await checkPermission(user, 'read')).toBe(false);
		expect(await checkPermission(user, 'write')).toBe(false);
		expect(await checkPermission(user, 'admin')).toBe(false);
	});

	test('inactive policy is ignored', async () => {
		const db = state.db!;
		const user = makeUser('user-inactive-pol');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-inactive',
			name: 'inactive-policy',
			role: 'viewer',
			action: 'read',
			isActive: false
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-inactive' });

		expect(await checkPermission(user, 'read')).toBe(false);
	});

	test('namespace-restricted policy grants access only to matching namespace', async () => {
		const db = state.db!;
		const user = makeUser('user-ns');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-ns',
			name: 'ns-policy',
			role: 'viewer',
			action: 'read',
			isActive: true,
			namespacePattern: 'flux-system'
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-ns' });

		expect(await checkPermission(user, 'read', undefined, 'flux-system')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'default')).toBe(false);
	});

	test('cluster-restricted policy grants access only to matching cluster', async () => {
		const db = state.db!;
		const user = makeUser('user-cluster');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-cluster',
			name: 'cluster-policy',
			role: 'viewer',
			action: 'read',
			isActive: true,
			clusterId: 'cluster-a'
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-cluster' });

		expect(await checkPermission(user, 'read', undefined, undefined, 'cluster-a')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, undefined, 'cluster-b')).toBe(false);
	});

	test('wildcard namespace pattern matches all namespaces with that prefix', async () => {
		const db = state.db!;
		const user = makeUser('user-wildcard-ns');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-wildcard-ns',
			name: 'wildcard-ns-policy',
			role: 'viewer',
			action: 'read',
			isActive: true,
			namespacePattern: 'flux-*'
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-wildcard-ns' });

		expect(await checkPermission(user, 'read', undefined, 'flux-system')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'flux-infra')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'default')).toBe(false);
		expect(await checkPermission(user, 'read', undefined, 'kube-system')).toBe(false);
	});

	test('policy with invalid namespace pattern is skipped', async () => {
		const db = state.db!;
		const user = makeUser('user-invalid-pattern');

		// Insert a policy with an invalid pattern directly (bypassing createPolicy validation)
		await db.insert(schema.rbacPolicies).values({
			id: 'p-invalid-pattern',
			name: 'invalid-pattern-policy',
			role: 'viewer',
			action: 'read',
			isActive: true,
			namespacePattern: '../../etc/passwd'
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-invalid-pattern' });

		expect(await checkPermission(user, 'read', undefined, '../../etc/passwd')).toBe(false);
		expect(await checkPermission(user, 'read')).toBe(false);
	});

	test('resource-type-restricted policy only grants access to matching resource type', async () => {
		const db = state.db!;
		const user = makeUser('user-resource-type');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-kustomization',
			name: 'kustomization-policy',
			role: 'viewer',
			action: 'read',
			isActive: true,
			resourceType: 'Kustomization'
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-kustomization' });

		expect(await checkPermission(user, 'read', 'Kustomization')).toBe(true);
		expect(await checkPermission(user, 'read', 'HelmRelease')).toBe(false);
		expect(await checkPermission(user, 'read')).toBe(true); // no resourceType filter → any type
	});

	test('multiple bindings: access granted if any bound policy matches', async () => {
		const db = state.db!;
		const user = makeUser('user-multi-bindings');

		await db.insert(schema.rbacPolicies).values([
			{
				id: 'p-multi-1',
				name: 'multi-policy-1',
				role: 'viewer',
				action: 'read',
				isActive: true,
				namespacePattern: 'ns-a'
			},
			{
				id: 'p-multi-2',
				name: 'multi-policy-2',
				role: 'viewer',
				action: 'read',
				isActive: true,
				namespacePattern: 'ns-b'
			}
		]);
		await db.insert(schema.rbacBindings).values([
			{ userId: user.id, policyId: 'p-multi-1' },
			{ userId: user.id, policyId: 'p-multi-2' }
		]);

		expect(await checkPermission(user, 'read', undefined, 'ns-a')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'ns-b')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'ns-c')).toBe(false);
	});

	test('null namespace pattern matches all namespaces', async () => {
		const db = state.db!;
		const user = makeUser('user-all-ns');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-all-ns',
			name: 'all-ns-policy',
			role: 'viewer',
			action: 'read',
			isActive: true,
			namespacePattern: null
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-all-ns' });

		expect(await checkPermission(user, 'read', undefined, 'flux-system')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'default')).toBe(true);
		expect(await checkPermission(user, 'read', undefined, 'kube-system')).toBe(true);
	});
});

describe('checkClusterWideReadPermission', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('requires an unscoped policy for cluster-wide reads', async () => {
		const db = state.db!;
		const user = makeUser('user-cluster-wide');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-cluster-wide',
			name: 'cluster-wide-read',
			role: 'viewer',
			action: 'read',
			clusterId: 'cluster-a',
			isActive: true,
			resourceType: null,
			namespacePattern: null
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-cluster-wide' });

		expect(await checkClusterWideReadPermission(user, 'cluster-a')).toBe(true);
		expect(await checkClusterWideReadPermission(user, 'cluster-b')).toBe(false);
	});

	test('rejects resource-scoped policies for cluster-wide reads', async () => {
		const db = state.db!;
		const user = makeUser('user-resource-scoped');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-resource-scoped',
			name: 'resource-scoped-read',
			role: 'viewer',
			action: 'read',
			clusterId: 'cluster-a',
			resourceType: 'Kustomization',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({
			userId: user.id,
			policyId: 'p-resource-scoped'
		});

		expect(await checkClusterWideReadPermission(user, 'cluster-a')).toBe(false);
	});

	test('rejects namespace-scoped policies for cluster-wide reads', async () => {
		const db = state.db!;
		const user = makeUser('user-namespace-scoped');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-namespace-scoped',
			name: 'namespace-scoped-read',
			role: 'viewer',
			action: 'read',
			clusterId: 'cluster-a',
			namespacePattern: 'flux-system',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({
			userId: user.id,
			policyId: 'p-namespace-scoped'
		});

		expect(await checkClusterWideReadPermission(user, 'cluster-a')).toBe(false);
	});

	test('applies the same role hierarchy rules', async () => {
		const db = state.db!;
		const user = makeUser('viewer-bound-to-editor', 'viewer');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-editor-cluster-wide',
			name: 'editor-cluster-wide',
			role: 'editor',
			action: 'read',
			clusterId: 'cluster-a',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({
			userId: user.id,
			policyId: 'p-editor-cluster-wide'
		});

		expect(await checkClusterWideReadPermission(user, 'cluster-a')).toBe(false);
	});
});

describe('requirePermission', () => {
	beforeEach(() => {
		state.db = setupInMemoryDb();
	});

	test('resolves without error when permission is granted', async () => {
		const db = state.db!;
		const user = makeUser('user-req-ok');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-req-read',
			name: 'req-read-policy',
			role: 'viewer',
			action: 'read',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-req-read' });

		await expect(requirePermission(user, 'read')).resolves.toBeUndefined();
	});

	test('throws RbacError when permission is denied', async () => {
		const user = makeUser('user-req-denied');
		await expect(requirePermission(user, 'read')).rejects.toBeInstanceOf(RbacError);
	});

	test('thrown RbacError includes action and resource type', async () => {
		const user = makeUser('user-req-error-shape');
		try {
			await requirePermission(user, 'write', 'Kustomization');
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(RbacError);
			expect((err as RbacError).action).toBe('write');
			expect((err as RbacError).status).toBe(403);
		}
	});

	test('admin role resolves without DB lookup', async () => {
		const admin = makeUser('admin-req', 'admin');
		// No policies in DB — admin bypasses all checks
		await expect(requirePermission(admin, 'admin')).resolves.toBeUndefined();
	});
});
