import { describe, expect, test, vi } from 'vitest';
import { createClusterAndLog } from '../routes/admin/clusters/create-cluster.js';
import type { ClusterCreateInput } from '../routes/admin/clusters/create-validation.js';
import type { User } from '../lib/server/db/schema.js';

const actor = { id: 'admin-1' } as User;
const input: ClusterCreateInput = {
	name: 'production',
	description: 'Production cluster',
	kubeconfig: 'apiVersion: v1'
};
const createdCluster = { id: 'cluster-1', contextCount: 2 };

describe('create cluster action', () => {
	test('creates the cluster and records the audit event', async () => {
		const createCluster = vi.fn().mockResolvedValue(createdCluster);
		const logClusterChange = vi.fn().mockResolvedValue(undefined);

		await expect(
			createClusterAndLog(actor, input, { createCluster, logClusterChange })
		).resolves.toEqual({ success: true, cluster: createdCluster });
		expect(createCluster).toHaveBeenCalledWith({
			name: 'production',
			description: 'Production cluster',
			kubeconfig: 'apiVersion: v1',
			isLocal: true
		});
		expect(logClusterChange).toHaveBeenCalledWith(actor, 'create', 'production', {
			clusterId: 'cluster-1',
			contextCount: 2
		});
	});

	test('returns a client error for duplicate cluster names', async () => {
		const result = await createClusterAndLog(actor, input, {
			createCluster: vi
				.fn()
				.mockRejectedValue(new Error('UNIQUE constraint failed: clusters.name')),
			logClusterChange: vi.fn()
		});

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'A cluster with this name already exists' }
		});
	});

	test('returns a server error for unexpected failures', async () => {
		const result = await createClusterAndLog(actor, input, {
			createCluster: vi.fn().mockRejectedValue(new Error('invalid kubeconfig')),
			logClusterChange: vi.fn()
		});

		expect(result).toMatchObject({ status: 500, data: { error: 'Failed to create cluster' } });
	});
});
