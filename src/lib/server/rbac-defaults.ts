/**
 * Default RBAC Policies
 * Auto-creates standard policies for viewer, editor, and admin roles
 */

import { logger } from './logger.js';
import { getDbSync } from './db/index.js';
import { rbacPolicies, rbacBindings, type User } from './db/schema.js';
import { eq, and } from 'drizzle-orm';

type Tx = Parameters<Parameters<ReturnType<typeof getDbSync>['transaction']>[0]>[0];

/**
 * Default policy IDs (deterministic UUIDs for idempotency)
 */
export const DEFAULT_POLICY_IDS = {
	VIEWER_READ_ALL: '00000000-0000-0000-0000-000000000001',
	EDITOR_READ_ALL: '00000000-0000-0000-0000-000000000002',
	EDITOR_WRITE_ALL: '00000000-0000-0000-0000-000000000003'
	// Admin role doesn't need policies (has full access by role)
};

/**
 * Initialize default RBAC policies if they don't exist
 * Called on application startup
 */
export async function initializeDefaultPolicies(): Promise<void> {
	const db = getDbSync();

	const defaultPolicies = [
		{
			id: DEFAULT_POLICY_IDS.VIEWER_READ_ALL,
			name: 'Viewer: Read All Resources',
			description: 'Default policy for viewer role - read access to all FluxCD resources',
			role: 'viewer' as const,
			action: 'read' as const,
			resourceType: null, // null = all resource types
			namespacePattern: null, // null = all namespaces
			clusterId: null, // null = all clusters
			isActive: true
		},
		{
			id: DEFAULT_POLICY_IDS.EDITOR_READ_ALL,
			name: 'Editor: Read All Resources',
			description: 'Default policy for editor role - read access to all FluxCD resources',
			role: 'editor' as const,
			action: 'read' as const,
			resourceType: null,
			namespacePattern: null,
			clusterId: null,
			isActive: true
		},
		{
			id: DEFAULT_POLICY_IDS.EDITOR_WRITE_ALL,
			name: 'Editor: Write All Resources',
			description:
				'Default policy for editor role - write access (suspend, resume, reconcile) to all FluxCD resources',
			role: 'editor' as const,
			action: 'write' as const,
			resourceType: null,
			namespacePattern: null,
			clusterId: null,
			isActive: true
		}
	];

	// Insert policies if they don't exist (using INSERT OR IGNORE pattern)
	for (const policy of defaultPolicies) {
		const existing = await db.query.rbacPolicies.findFirst({
			where: eq(rbacPolicies.id, policy.id)
		});

		if (!existing) {
			await db.insert(rbacPolicies).values(policy);
			logger.info(`   ✓ Created default policy: ${policy.name}`);
		}
	}
}

/**
 * Auto-bind a user to their role's default policies
 * Called when a new user is created
 */
export async function bindUserToDefaultPolicies(user: User): Promise<void> {
	const db = getDbSync();
	db.transaction((tx) => {
		bindUserToDefaultPoliciesInTx(tx, user);
	});
}

export function bindUserToDefaultPoliciesInTx(tx: Tx, user: User): void {
	// Admin role doesn't need policy bindings (has full access by role)
	if (user.role === 'admin') {
		return;
	}

	const policiesToBind: string[] = [];

	// Determine which policies to bind based on role
	if (user.role === 'viewer') {
		policiesToBind.push(DEFAULT_POLICY_IDS.VIEWER_READ_ALL);
	} else if (user.role === 'editor') {
		policiesToBind.push(DEFAULT_POLICY_IDS.EDITOR_READ_ALL);
		policiesToBind.push(DEFAULT_POLICY_IDS.EDITOR_WRITE_ALL);
	}

	// Bind policies to user (skip if already bound)
	for (const policyId of policiesToBind) {
		const existing = tx
			.select({ userId: rbacBindings.userId })
			.from(rbacBindings)
			.where(and(eq(rbacBindings.userId, user.id), eq(rbacBindings.policyId, policyId)))
			.get();

		if (!existing) {
			tx.insert(rbacBindings).values({ userId: user.id, policyId }).run();
		}
	}
}

/**
 * Fix existing users who don't have default policy bindings
 * Called as a migration/repair function
 */
export async function repairUserPolicyBindings(): Promise<number> {
	const db = getDbSync();

	// Get all non-admin users
	const users = await db.query.users.findMany({
		where: (users, { ne }) => ne(users.role, 'admin')
	});

	let repairedCount = 0;

	for (const user of users) {
		// Check if user has any bindings
		const bindings = await db.query.rbacBindings.findMany({
			where: eq(rbacBindings.userId, user.id)
		});

		// If no bindings, add default ones
		if (bindings.length === 0) {
			await bindUserToDefaultPolicies(user);
			repairedCount++;
			logger.info(`   ✓ Repaired RBAC bindings for user with role: ${user.role}`);
		}
	}

	return repairedCount;
}

/**
 * Sync user's policy bindings to match their current role
 * Called when a user's role is changed
 */
export async function syncUserPolicyBindings(user: User): Promise<void> {
	const db = getDbSync();
	db.transaction((tx) => {
		syncUserPolicyBindingsInTx(tx, user);
	});

	logger.info(`   ✓ Synced RBAC bindings for role: ${user.role}`);
}

export function syncUserPolicyBindingsInTx(tx: Tx, user: User): void {
	// Admin doesn't need policy bindings
	if (user.role === 'admin') {
		// Remove all bindings for admin users
		tx.delete(rbacBindings).where(eq(rbacBindings.userId, user.id)).run();
		return;
	}

	// Remove all existing bindings first
	tx.delete(rbacBindings).where(eq(rbacBindings.userId, user.id)).run();

	// Add correct bindings for current role
	bindUserToDefaultPoliciesInTx(tx, user);
}
