import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getAllPoliciesPaginated,
	createPolicy,
	deletePolicy,
	getUserPolicies,
	bindPolicyToUser,
	unbindPolicyFromUser
} from '$lib/server/rbac';
import { listUsers } from '$lib/server/auth';
import { isAdmin } from '$lib/server/rbac';
import { logRbacChange } from '$lib/server/audit';
import type { RbacAction } from '$lib/server/rbac';

/**
 * Load function for RBAC policy management page
 */
export const load: PageServerLoad = async ({ url }) => {
	// Get pagination and search params from URL
	const search = url.searchParams.get('search') || '';
	const limitParam = parseInt(url.searchParams.get('limit') || '10');
	const offsetParam = parseInt(url.searchParams.get('offset') || '0');
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 10;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	// Load paginated policies and all users
	const [{ policies, total }, users] = await Promise.all([
		getAllPoliciesPaginated({ search, limit, offset }),
		listUsers()
	]);

	// Get policies for each user
	const userPolicies: Record<string, Awaited<ReturnType<typeof getUserPolicies>>> = {};
	for (const user of users) {
		userPolicies[user.id] = await getUserPolicies(user.id);
	}

	return {
		policies: policies.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			role: p.role,
			action: p.action,
			resourceType: p.resourceType,
			namespacePattern: p.namespacePattern,
			clusterId: p.clusterId,
			isActive: p.isActive,
			createdAt: p.createdAt,
			updatedAt: p.updatedAt
		})),
		total,
		search,
		limit,
		offset,
		users: users.map((u) => ({
			id: u.id,
			username: u.username,
			role: u.role,
			active: u.active
		})),
		userPolicies
	};
};

export const actions: Actions = {
	/**
	 * Create a new RBAC policy
	 */
	create: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const role = formData.get('role') as 'admin' | 'editor' | 'viewer';
		const action = formData.get('action') as RbacAction;
		const resourceType = formData.get('resourceType') as string;
		const namespacePattern = formData.get('namespacePattern') as string;

		// Validation
		if (!name || !role || !action) {
			return fail(400, { error: 'Name, role, and action are required' });
		}

		if (name.length < 3) {
			return fail(400, { error: 'Policy name must be at least 3 characters' });
		}

		try {
			const policyId = await createPolicy({
				name,
				description: description || undefined,
				role,
				action,
				resourceType: resourceType || undefined,
				namespacePattern: namespacePattern || undefined
			});

			await logRbacChange(locals.user, 'create', name, undefined, {
				role,
				action,
				resourceType,
				namespacePattern
			});

			return { success: true, policyId };
		} catch (error) {
			console.error('Error creating policy:', error);
			return fail(500, { error: 'Failed to create policy' });
		}
	},

	/**
	 * Delete a policy
	 */
	delete: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const policyId = formData.get('policyId') as string;
		const policyName = formData.get('policyName') as string;

		if (!policyId) {
			return fail(400, { error: 'Policy ID is required' });
		}

		try {
			await deletePolicy(policyId);

			await logRbacChange(locals.user, 'delete', policyName || 'unknown', undefined, { policyId });

			return { success: true };
		} catch (error) {
			console.error('Error deleting policy:', error);
			return fail(500, { error: 'Failed to delete policy' });
		}
	},

	/**
	 * Bind a policy to a user
	 */
	bind: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const policyId = formData.get('policyId') as string;
		const policyName = formData.get('policyName') as string;

		if (!userId || !policyId) {
			return fail(400, { error: 'User ID and Policy ID are required' });
		}

		try {
			await bindPolicyToUser(userId, policyId);

			await logRbacChange(locals.user, 'bind', policyName || 'unknown', userId, { policyId });

			return { success: true };
		} catch (error) {
			console.error('Error binding policy:', error);
			return fail(500, { error: 'Failed to bind policy to user' });
		}
	},

	/**
	 * Unbind a policy from a user
	 */
	unbind: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const policyId = formData.get('policyId') as string;
		const policyName = formData.get('policyName') as string;

		if (!userId || !policyId) {
			return fail(400, { error: 'User ID and Policy ID are required' });
		}

		try {
			await unbindPolicyFromUser(userId, policyId);

			await logRbacChange(locals.user, 'unbind', policyName || 'unknown', userId, { policyId });

			return { success: true };
		} catch (error) {
			console.error('Error unbinding policy:', error);
			return fail(500, { error: 'Failed to unbind policy from user' });
		}
	}
};
