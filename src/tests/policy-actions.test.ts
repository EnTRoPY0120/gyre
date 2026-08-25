import { describe, expect, test, vi } from 'vitest';
import {
	createPolicyAndLog,
	deletePolicyAndLog,
	type PolicyActionDependencies,
	type PolicyCreateFormInput
} from '../routes/admin/policies/policy-actions.js';
import type { User } from '../lib/server/db/schema.js';

const admin = { id: 'admin-1', role: 'admin' } as User;
const input: PolicyCreateFormInput = {
	name: 'read-prod',
	description: '',
	role: 'viewer',
	action: 'read',
	resourceType: '',
	namespacePattern: ''
};

function makeDependencies(
	overrides: Partial<PolicyActionDependencies> = {}
): PolicyActionDependencies {
	return {
		createPolicy: vi.fn().mockResolvedValue('policy-1'),
		deletePolicy: vi.fn().mockResolvedValue(undefined),
		logRbacChange: vi.fn().mockResolvedValue(undefined),
		logger: { error: vi.fn() },
		...overrides
	};
}

describe('policy actions', () => {
	test('creates a policy with undefined optional fields and audits it', async () => {
		const dependencies = makeDependencies();

		await expect(createPolicyAndLog(admin, input, dependencies)).resolves.toEqual({
			success: true,
			policyId: 'policy-1'
		});
		expect(dependencies.createPolicy).toHaveBeenCalledWith({
			name: 'read-prod',
			description: undefined,
			role: 'viewer',
			action: 'read',
			resourceType: undefined,
			namespacePattern: undefined
		});
		expect(dependencies.logRbacChange).toHaveBeenCalledWith(
			admin,
			'create',
			'read-prod',
			undefined,
			expect.objectContaining({ role: 'viewer', action: 'read' })
		);
	});

	test('returns a server failure when policy creation fails', async () => {
		const error = new Error('database unavailable');
		const dependencies = makeDependencies({ createPolicy: vi.fn().mockRejectedValue(error) });

		const result = await createPolicyAndLog(admin, input, dependencies);

		expect(result).toMatchObject({ status: 500, data: { error: 'Failed to create policy' } });
		expect(dependencies.logger.error).toHaveBeenCalledWith(error, 'Error creating policy:');
		expect(dependencies.logRbacChange).not.toHaveBeenCalled();
	});

	test('deletes a policy and audits unknown names safely', async () => {
		const dependencies = makeDependencies();

		await expect(deletePolicyAndLog(admin, 'policy-1', '', dependencies)).resolves.toEqual({
			success: true
		});
		expect(dependencies.deletePolicy).toHaveBeenCalledWith('policy-1');
		expect(dependencies.logRbacChange).toHaveBeenCalledWith(admin, 'delete', 'unknown', undefined, {
			policyId: 'policy-1'
		});
	});

	test('returns a server failure when policy deletion fails', async () => {
		const error = new Error('delete failed');
		const dependencies = makeDependencies({ deletePolicy: vi.fn().mockRejectedValue(error) });

		const result = await deletePolicyAndLog(admin, 'policy-1', 'read-prod', dependencies);

		expect(result).toMatchObject({ status: 500, data: { error: 'Failed to delete policy' } });
		expect(dependencies.logger.error).toHaveBeenCalledWith(error, 'Error deleting policy:');
	});
});
