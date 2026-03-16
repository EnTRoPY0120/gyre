import type { User } from './db/schema.js';
import { getDbSync } from './db/index.js';
import { rbacPolicies, rbacBindings } from './db/schema.js';
import { getPaginatedItems, sanitizeSearchInput } from './db/utils.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { logger } from './logger.js';

/**
 * RBAC Actions
 * - read: View resources
 * - write: Suspend, resume, reconcile resources
 * - admin: Delete resources, manage policies
 */
export type RbacAction = 'read' | 'write' | 'admin';

// Allowlist for namespace GLOB patterns: Kubernetes namespace chars plus * and ? wildcards.
// Kubernetes namespace names are lowercase alphanumeric with hyphens.
const NAMESPACE_PATTERN_REGEX = /^[a-z0-9*?][a-z0-9\-*?]*$/;

/**
 * Returns true if the given namespace GLOB pattern is safe to execute.
 * Rejects patterns that contain characters outside the Kubernetes namespace
 * alphabet and the two SQLite GLOB wildcards (* ?).
 */
export function isValidNamespacePattern(pattern: string): boolean {
	return NAMESPACE_PATTERN_REGEX.test(pattern);
}

/**
 * Check if a user has permission to perform an action on a resource.
 *
 * Logic:
 * 1. Admin role always has full access
 * 2. Check user's RBAC bindings for matching policies
 * 3. Policies with invalid namespacePattern values are skipped (logged as warnings)
 * 4. Policy must match: role, action, resourceType, namespace (if restricted), cluster (if restricted)
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

	// Fetch namespace patterns for all candidate policies so we can validate them
	// before passing them to SQLite GLOB. Policies with invalid patterns are skipped.
	const candidatePolicies = await db
		.select({ id: rbacPolicies.id, namespacePattern: rbacPolicies.namespacePattern })
		.from(rbacPolicies)
		.where(
			and(
				sql`${rbacPolicies.id} IN (${sql.join(policyIds, sql`, `)})`,
				eq(rbacPolicies.isActive, true)
			)
		);

	const validPolicyIds: string[] = [];
	for (const policy of candidatePolicies) {
		if (policy.namespacePattern !== null && !isValidNamespacePattern(policy.namespacePattern)) {
			logger.warn(
				`Skipping RBAC policy ${policy.id} with invalid namespacePattern: "${policy.namespacePattern}"`
			);
			continue;
		}
		validPolicyIds.push(policy.id);
	}

	if (validPolicyIds.length === 0) {
		return false;
	}

	// Build query conditions
	const conditions = [
		// Policy must be active
		eq(rbacPolicies.isActive, true),
		// Policy must be one of the validated policies
		sql`${rbacPolicies.id} IN (${sql.join(validPolicyIds, sql`, `)})`,
		// Action must be allowed (read < write < admin hierarchy)
		or(
			eq(rbacPolicies.action, action),
			// Admin action allows everything below it
			and(eq(rbacPolicies.action, 'admin'), sql`${sql.param(action)} IN ('read', 'write')`),
			// Write action allows read
			and(eq(rbacPolicies.action, 'write'), eq(sql`${sql.param(action)}`, 'read'))
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
				// Match namespace against pattern (supports * and ? wildcards only)
				sql`${sql.param(namespace)} GLOB ${rbacPolicies.namespacePattern}`
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
	if (policy.namespacePattern && !isValidNamespacePattern(policy.namespacePattern)) {
		throw new Error(
			'Invalid namespace pattern: must contain only lowercase alphanumeric characters, hyphens, and wildcards (* ?)'
		);
	}

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
		(search) => {
			const sanitized = sanitizeSearchInput(search);
			const pattern = `%${sanitized}%`;
			return or(
				sql`${rbacPolicies.name} LIKE ${pattern} ESCAPE '\\'`,
				sql`${rbacPolicies.description} LIKE ${pattern} ESCAPE '\\'`
			);
		}
	);

	return { policies: result.items, total: result.total };
}

/**
 * Delete a policy (and all its bindings).
 * Returns the number of bindings removed (i.e. the number of user–policy associations
 * that were revoked). Callers can use this to surface warnings when users may lose access.
 *
 * The count, binding deletion, and policy deletion run inside a single transaction so
 * the returned count always reflects the exact rows removed, even under concurrency.
 */
export async function deletePolicy(policyId: string): Promise<number> {
	const db = getDbSync();

	return db.transaction((tx) => {
		const removedBindings = tx
			.select({ count: sql<number>`count(*)` })
			.from(rbacBindings)
			.where(eq(rbacBindings.policyId, policyId))
			.get();

		const removedBindingCount = removedBindings?.count ?? 0;

		tx.delete(rbacBindings).where(eq(rbacBindings.policyId, policyId)).run();
		tx.delete(rbacPolicies).where(eq(rbacPolicies.id, policyId)).run();

		return removedBindingCount;
	});
}

/**
 * Quarantine RBAC policies whose namespacePattern contains characters outside the
 * safe allowlist (lowercase alphanumeric, hyphens, * and ?). Affected policies are
 * deactivated so they cannot be executed by checkPermission.
 *
 * Returns the number of policies quarantined.
 * Call this once on startup (e.g. from initializeGyre) to backfill rows that were
 * inserted before pattern validation was enforced.
 */
export async function quarantineInvalidNamespacePatterns(): Promise<number> {
	const db = getDbSync();

	const allPolicies = await db
		.select({ id: rbacPolicies.id, namespacePattern: rbacPolicies.namespacePattern })
		.from(rbacPolicies)
		.where(eq(rbacPolicies.isActive, true));

	let quarantined = 0;
	for (const policy of allPolicies) {
		if (policy.namespacePattern !== null && !isValidNamespacePattern(policy.namespacePattern)) {
			logger.warn(
				`Quarantining RBAC policy ${policy.id}: invalid namespacePattern "${policy.namespacePattern}"`
			);
			await db.update(rbacPolicies).set({ isActive: false }).where(eq(rbacPolicies.id, policy.id));
			quarantined++;
		}
	}

	return quarantined;
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
