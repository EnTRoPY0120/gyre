import type { User } from './db/schema.js';
import { getDbSync } from './db/index.js';
import { rbacPolicies, rbacBindings } from './db/schema.js';
import { getPaginatedItems } from './db/utils.js';
import { eq, and, or, sql, like } from 'drizzle-orm';

/**
 * RBAC Actions
 * - read: View resources
 * - write: Suspend, resume, reconcile resources
 * - admin: Delete resources, manage policies
 */
export type RbacAction = 'read' | 'write' | 'admin';

/**
 * Check if a user has permission to perform an action on a resource
 *
 * Logic:
 * 1. Admin role always has full access
 * 2. Check user's RBAC bindings for matching policies
 * 3. Policy must match: role, action, resourceType, namespace (if restricted), cluster (if restricted)
 */
export async function checkPermission(
	user: User,
	action: RbacAction,
	resourceType?: string,
	namespace?: string,
	clusterId?: string
): Promise<boolean> {
	// Admin role has full access to everything
	if (user.role === 'admin') {
		return true;
	}

	const db = getDbSync();

	// Get all policies bound to this user
	const userBindings = await db
		.select({
			policyId: rbacBindings.policyId
		})
		.from(rbacBindings)
		.where(eq(rbacBindings.userId, user.id));

	if (userBindings.length === 0) {
		return false;
	}

	const policyIds = userBindings.map((b) => b.policyId);

	// Build query conditions
	const conditions = [
		// Policy must be active
		eq(rbacPolicies.isActive, true),
		// Policy must match one of user's bound policies
		sql`${rbacPolicies.id} IN (${sql.join(policyIds, sql`, `)})`,
		// Action must be allowed (read < write < admin hierarchy)
		or(
			eq(rbacPolicies.action, action),
			// Admin action allows everything below it
			and(eq(rbacPolicies.action, 'admin'), sql`${action} IN ('read', 'write')`),
			// Write action allows read
			and(eq(rbacPolicies.action, 'write'), eq(sql`${action}`, 'read'))
		)
	];

	// If resource type specified, check if policy allows it (or allows all with null)
	if (resourceType) {
		conditions.push(
			or(
				eq(rbacPolicies.resourceType, resourceType),
				// null means all resource types
				sql`${rbacPolicies.resourceType} IS NULL`
			)
		);
	}

	// If namespace specified, check if policy restricts it
	if (namespace) {
		conditions.push(
			or(
				// null pattern means all namespaces
				sql`${rbacPolicies.namespacePattern} IS NULL`,
				// Match namespace against pattern (supports wildcards)
				sql`${namespace} GLOB ${rbacPolicies.namespacePattern}`
			)
		);
	}

	// If cluster specified, check if policy restricts it
	if (clusterId) {
		conditions.push(
			or(
				// null clusterId means all clusters
				sql`${rbacPolicies.clusterId} IS NULL`,
				eq(rbacPolicies.clusterId, clusterId)
			)
		);
	}

	// Check if any matching policy exists
	const matchingPolicies = await db
		.select({ count: sql<number>`count(*)` })
		.from(rbacPolicies)
		.where(and(...conditions))
		.get();

	return (matchingPolicies?.count ?? 0) > 0;
}

/**
 * Require permission or throw error
 */
export async function requirePermission(
	user: User,
	action: RbacAction,
	resourceType?: string,
	namespace?: string,
	clusterId?: string
): Promise<void> {
	const hasPermission = await checkPermission(user, action, resourceType, namespace, clusterId);
	if (!hasPermission) {
		throw new RbacError(`Permission denied: ${action} on ${resourceType || 'resource'}`, action);
	}
}

/**
 * Custom RBAC error
 */
export class RbacError extends Error {
	constructor(
		message: string,
		public action: RbacAction,
		public resourceType?: string
	) {
		super(message);
		this.name = 'RbacError';
	}
}

/**
 * Create a new RBAC policy
 */
export async function createPolicy(policy: {
	name: string;
	description?: string;
	role: 'admin' | 'editor' | 'viewer';
	action: RbacAction;
	resourceType?: string;
	namespacePattern?: string;
	clusterId?: string;
}): Promise<string> {
	const db = getDbSync();
	const id = crypto.randomUUID();

	await db.insert(rbacPolicies).values({
		id,
		name: policy.name,
		description: policy.description || null,
		role: policy.role,
		action: policy.action,
		resourceType: policy.resourceType || null,
		namespacePattern: policy.namespacePattern || null,
		clusterId: policy.clusterId || null,
		isActive: true
	});

	return id;
}

/**
 * Bind a policy to a user
 */
export async function bindPolicyToUser(userId: string, policyId: string): Promise<void> {
	const db = getDbSync();
	await db.insert(rbacBindings).values({
		userId,
		policyId
	});
}

/**
 * Unbind a policy from a user
 */
export async function unbindPolicyFromUser(userId: string, policyId: string): Promise<void> {
	const db = getDbSync();
	await db
		.delete(rbacBindings)
		.where(and(eq(rbacBindings.userId, userId), eq(rbacBindings.policyId, policyId)));
}

/**
 * Get all policies for a user
 */
export async function getUserPolicies(userId: string) {
	const db = getDbSync();

	const results = await db
		.select({
			policy: rbacPolicies
		})
		.from(rbacBindings)
		.innerJoin(rbacPolicies, eq(rbacBindings.policyId, rbacPolicies.id))
		.where(eq(rbacBindings.userId, userId));

	return results.map((r) => r.policy);
}

/**
 * Get all available policies
 */
export async function getAllPolicies() {
	const db = getDbSync();
	return db.query.rbacPolicies.findMany({
		orderBy: (policies, { desc }) => [desc(policies.createdAt)]
	});
}

/**
 * Get policies with pagination and search
 */
export async function getAllPoliciesPaginated(options?: {
	search?: string;
	limit?: number;
	offset?: number;
}): Promise<{ policies: (typeof rbacPolicies.$inferSelect)[]; total: number }> {
	const result = await getPaginatedItems<typeof rbacPolicies, typeof rbacPolicies.$inferSelect>(
		rbacPolicies,
		(db) => db.query.rbacPolicies,
		options,
		(search) =>
			or(like(rbacPolicies.name, `%${search}%`), like(rbacPolicies.description, `%${search}%`))
	);

	return { policies: result.items, total: result.total };
}

/**
 * Delete a policy (and all its bindings)
 */
export async function deletePolicy(policyId: string): Promise<void> {
	const db = getDbSync();

	// Delete bindings first (cascade should handle this, but let's be explicit)
	await db.delete(rbacBindings).where(eq(rbacBindings.policyId, policyId));

	// Delete policy
	await db.delete(rbacPolicies).where(eq(rbacPolicies.id, policyId));
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User): boolean {
	return user.role === 'admin';
}

/**
 * Check if user can perform admin actions
 */
export async function canAdmin(user: User): Promise<boolean> {
	if (user.role === 'admin') return true;
	return checkPermission(user, 'admin');
}
