import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';

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

import { checkPermission, isAdmin } from '../lib/server/rbac.js';
import type { User } from '../lib/server/db/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREATE_USERS = `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		email TEXT,
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
		passwordHash: 'hash',
		email: null,
		role,
		active: true,
		isLocal: true,
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
		const user = makeUser('user-write');

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

	test('admin policy grants read, write, and admin', async () => {
		const db = state.db!;
		const user = makeUser('user-admin-policy');

		await db.insert(schema.rbacPolicies).values({
			id: 'p-admin',
			name: 'admin-policy',
			role: 'admin',
			action: 'admin',
			isActive: true
		});
		await db.insert(schema.rbacBindings).values({ userId: user.id, policyId: 'p-admin' });

		expect(await checkPermission(user, 'read')).toBe(true);
		expect(await checkPermission(user, 'write')).toBe(true);
		expect(await checkPermission(user, 'admin')).toBe(true);
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
