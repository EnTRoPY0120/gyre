import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { deleteCluster, getClusterById, updateCluster } from '$lib/server/clusters';
import { logClusterChange } from '$lib/server/audit';
import { invalidateDashboardCache } from '$lib/server/dashboard-cache';
import { clearClientPool } from '$lib/server/kubernetes/client.js';
import type { User } from '$lib/server/db/schema';

type ClusterActionDependencies = {
	updateCluster: typeof updateCluster;
	deleteCluster: typeof deleteCluster;
	getClusterById: typeof getClusterById;
	logClusterChange: typeof logClusterChange;
	invalidateDashboardCache: typeof invalidateDashboardCache;
	clearClientPool: typeof clearClientPool;
};

const defaultDependencies: ClusterActionDependencies = {
	updateCluster,
	deleteCluster,
	getClusterById,
	logClusterChange,
	invalidateDashboardCache,
	clearClientPool
};

export async function toggleClusterAndLog(
	user: User,
	clusterId: string,
	isActive: boolean,
	dependencies: ClusterActionDependencies = defaultDependencies
) {
	try {
		const updated = await dependencies.updateCluster(clusterId, { isActive });

		if (updated) {
			dependencies.clearClientPool(clusterId);
			dependencies.invalidateDashboardCache(clusterId);
			await dependencies.logClusterChange(user, 'update', updated.name, { clusterId, isActive });
		}

		return { success: true, isActive };
	} catch (error) {
		logger.error(error, 'Error updating cluster:');
		return fail(500, { error: 'Failed to update cluster' });
	}
}

export async function deleteClusterAndLog(
	user: User,
	clusterId: string,
	dependencies: ClusterActionDependencies = defaultDependencies
) {
	try {
		const existing = await dependencies.getClusterById(clusterId);
		if (!existing) return fail(404, { error: 'Cluster not found' });

		await dependencies.deleteCluster(clusterId);
		dependencies.clearClientPool(clusterId);
		dependencies.invalidateDashboardCache(clusterId);
		await dependencies.logClusterChange(user, 'delete', existing.name, { clusterId });

		return { success: true };
	} catch (error) {
		logger.error(error, 'Error deleting cluster:');
		return fail(500, { error: 'Failed to delete cluster' });
	}
}
