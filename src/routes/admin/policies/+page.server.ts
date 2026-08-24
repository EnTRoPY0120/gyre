import { logger } from '$lib/server/logger.js';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getAllPoliciesPaginated,
	createPolicy,
	deletePolicy,
	getAllUserPolicies,
	bindPolicyToUser,
	unbindPolicyFromUser,
	type RbacAction
} from '$lib/server/rbac';
import { listUsers } from '$lib/server/auth';
import { logRbacChange } from '$lib/server/audit';
import { parseAdminPagination } from '../pagination';
import { validatePolicyCreateInput } from './create-validation';
import {
	getRequiredFormString,
	requireAdminFormUser,
	serializePagination
} from '../server-helpers';
import type { User } from '$lib/server/db/schema';

interface PolicyCreateFormInput {
	name: string;
	description: string;
	role: 'admin' | 'editor' | 'viewer';
	action: RbacAction;
	resourceType: string;
	namespacePattern: string;
}

function readPolicyCreateInput(formData: FormData): PolicyCreateFormInput {
	return {
		name: formData.get('name') as string,
		description: formData.get('description') as string,
		role: formData.get('role') as PolicyCreateFormInput['role'],
		action: formData.get('action') as RbacAction,
		resourceType: formData.get('resourceType') as string,
		namespacePattern: formData.get('namespacePattern') as string
	};
}

async function createPolicyAndLog(user: User, input: PolicyCreateFormInput) {
	try {
		const policyId = await createPolicy({
			name: input.name,
			description: input.description || undefined,
			role: input.role,
			action: input.action,
			resourceType: input.resourceType || undefined,
			namespacePattern: input.namespacePattern || undefined
		});

		await logRbacChange(user, 'create', input.name, undefined, {
			role: input.role,
			action: input.action,
			resourceType: input.resourceType,
			namespacePattern: input.namespacePattern
		});

		return { success: true, policyId };
	} catch (error) {
		logger.error(error, 'Error creating policy:');
		return fail(500, { error: 'Failed to create policy' });
	}
}

/**
 * Load function for RBAC policy management page
 */
export const load: PageServerLoad = async ({ url }) => {
	// Get pagination and search params from URL
	const pagination = parseAdminPagination(url);

	// Load paginated policies and all users
	const [page, users] = await Promise.all([getAllPoliciesPaginated(pagination), listUsers()]);

	// Batch-fetch policies for all users in a single JOIN query (avoids N+1)
	const allPoliciesByUser = await getAllUserPolicies(users.map((u) => u.id));
	const userPolicies: Awaited<ReturnType<typeof getAllUserPolicies>> = {};
	for (const user of users) {
		userPolicies[user.id] = allPoliciesByUser[user.id] ?? [];
	}

	return {
		...serializePagination(page, 'policies', (p) => ({
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
		...pagination,
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
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const input = readPolicyCreateInput(await request.formData());

		const validationError = validatePolicyCreateInput({
			name: input.name,
			role: input.role,
			action: input.action,
			namespacePattern: input.namespacePattern
		});
		if (validationError) return fail(400, { error: validationError });

		return createPolicyAndLog(user, input);
	},

	/**
	 * Delete a policy
	 */
	delete: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const policyId = getRequiredFormString(formData, 'policyId', 'Policy ID is required');
		if (typeof policyId !== 'string') return policyId;
		const policyName = formData.get('policyName') as string;

		try {
			await deletePolicy(policyId);

			await logRbacChange(user, 'delete', policyName || 'unknown', undefined, { policyId });

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error deleting policy:');
			return fail(500, { error: 'Failed to delete policy' });
		}
	},

	/**
	 * Bind a policy to a user
	 */
	bind: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const policyId = formData.get('policyId') as string;
		const policyName = formData.get('policyName') as string;

		if (!userId || !policyId) {
			return fail(400, { error: 'User ID and Policy ID are required' });
		}

		try {
			await bindPolicyToUser(userId, policyId);

			await logRbacChange(user, 'bind', policyName || 'unknown', userId, { policyId });

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error binding policy:');
			return fail(500, { error: 'Failed to bind policy to user' });
		}
	},

	/**
	 * Unbind a policy from a user
	 */
	unbind: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const policyId = formData.get('policyId') as string;
		const policyName = formData.get('policyName') as string;

		if (!userId || !policyId) {
			return fail(400, { error: 'User ID and Policy ID are required' });
		}

		try {
			await unbindPolicyFromUser(userId, policyId);

			await logRbacChange(user, 'unbind', policyName || 'unknown', userId, { policyId });

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error unbinding policy:');
			return fail(500, { error: 'Failed to unbind policy from user' });
		}
	}
};
