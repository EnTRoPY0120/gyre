import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { createPolicy, deletePolicy, type RbacAction } from '$lib/server/rbac';
import { logRbacChange } from '$lib/server/audit';
import type { User } from '$lib/server/db/schema';

export interface PolicyCreateFormInput {
	name: string;
	description: string;
	role: 'admin' | 'editor' | 'viewer';
	action: RbacAction;
	resourceType: string;
	namespacePattern: string;
}

export interface PolicyActionDependencies {
	createPolicy: typeof createPolicy;
	deletePolicy: typeof deletePolicy;
	logRbacChange: typeof logRbacChange;
	logger: Pick<typeof logger, 'error'>;
}

const defaultDependencies: PolicyActionDependencies = {
	createPolicy,
	deletePolicy,
	logRbacChange,
	logger
};

export async function createPolicyAndLog(
	user: User,
	input: PolicyCreateFormInput,
	dependencies: PolicyActionDependencies = defaultDependencies
) {
	try {
		const policyId = await dependencies.createPolicy({
			name: input.name,
			description: input.description || undefined,
			role: input.role,
			action: input.action,
			resourceType: input.resourceType || undefined,
			namespacePattern: input.namespacePattern || undefined
		});

		await dependencies.logRbacChange(user, 'create', input.name, undefined, {
			role: input.role,
			action: input.action,
			resourceType: input.resourceType,
			namespacePattern: input.namespacePattern
		});

		return { success: true, policyId };
	} catch (error) {
		dependencies.logger.error(error, 'Error creating policy:');
		return fail(500, { error: 'Failed to create policy' });
	}
}

export async function deletePolicyAndLog(
	user: User,
	policyId: string,
	policyName: string,
	dependencies: PolicyActionDependencies = defaultDependencies
) {
	try {
		await dependencies.deletePolicy(policyId);
		await dependencies.logRbacChange(user, 'delete', policyName || 'unknown', undefined, {
			policyId
		});

		return { success: true };
	} catch (error) {
		dependencies.logger.error(error, 'Error deleting policy:');
		return fail(500, { error: 'Failed to delete policy' });
	}
}
