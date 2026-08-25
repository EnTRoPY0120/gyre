import { describe, expect, test, vi } from 'vitest';
import {
	deleteClusterAndLog,
	toggleClusterAndLog
} from '../routes/admin/clusters/cluster-actions.js';
import type { User } from '../lib/server/db/schema.js';

const actor = { id: 'admin-1' } as User;

function createDependencies() {
	return {
		updateCluster: vi.fn(),
		deleteCluster: vi.fn(),
		getClusterById: vi.fn(),
		logClusterChange: vi.fn().mockResolvedValue(undefined),
		invalidateDashboardCache: vi.fn(),
		clearClientPool: vi.fn()
	};
}

describe('toggleClusterAndLog', () => {
	test('clears the client pool and records the audit event after an update', async () => {
		const dependencies = createDependencies();
		dependencies.updateCluster.mockResolvedValue({ name: 'production' });

		await expect(toggleClusterAndLog(actor, 'cluster-1', false, dependencies)).resolves.toEqual({
			success: true,
			isActive: false
		});
		expect(dependencies.clearClientPool).toHaveBeenCalledWith('cluster-1');
		expect(dependencies.invalidateDashboardCache).toHaveBeenCalledWith('cluster-1');
		expect(dependencies.logClusterChange).toHaveBeenCalledWith(actor, 'update', 'production', {
			clusterId: 'cluster-1',
			isActive: false
		});
	});

	test('returns success without side effects when the cluster was not updated', async () => {
		const dependencies = createDependencies();
		dependencies.updateCluster.mockResolvedValue(null);

		await expect(toggleClusterAndLog(actor, 'cluster-1', true, dependencies)).resolves.toEqual({
			success: true,
			isActive: true
		});
		expect(dependencies.clearClientPool).not.toHaveBeenCalled();
		expect(dependencies.logClusterChange).not.toHaveBeenCalled();
	});

	test('returns a server failure when updating the cluster fails', async () => {
		const dependencies = createDependencies();
		dependencies.updateCluster.mockRejectedValue(new Error('database unavailable'));

		await expect(
			toggleClusterAndLog(actor, 'cluster-1', true, dependencies)
		).resolves.toMatchObject({
			status: 500,
			data: { error: 'Failed to update cluster' }
		});
	});
});

describe('deleteClusterAndLog', () => {
	test('deletes the cluster and records the audit event', async () => {
		const dependencies = createDependencies();
		dependencies.getClusterById.mockResolvedValue({ name: 'production' });
		dependencies.deleteCluster.mockResolvedValue(undefined);

		await expect(deleteClusterAndLog(actor, 'cluster-1', dependencies)).resolves.toEqual({
			success: true
		});
		expect(dependencies.deleteCluster).toHaveBeenCalledWith('cluster-1');
		expect(dependencies.logClusterChange).toHaveBeenCalledWith(actor, 'delete', 'production', {
			clusterId: 'cluster-1'
		});
	});

	test('returns not found without deleting when the cluster is missing', async () => {
		const dependencies = createDependencies();
		dependencies.getClusterById.mockResolvedValue(null);

		await expect(deleteClusterAndLog(actor, 'cluster-1', dependencies)).resolves.toMatchObject({
			status: 404,
			data: { error: 'Cluster not found' }
		});
		expect(dependencies.deleteCluster).not.toHaveBeenCalled();
	});

	test('returns a server failure when deletion fails', async () => {
		const dependencies = createDependencies();
		dependencies.getClusterById.mockResolvedValue({ name: 'production' });
		dependencies.deleteCluster.mockRejectedValue(new Error('database unavailable'));

		await expect(deleteClusterAndLog(actor, 'cluster-1', dependencies)).resolves.toMatchObject({
			status: 500,
			data: { error: 'Failed to delete cluster' }
		});
	});
});
