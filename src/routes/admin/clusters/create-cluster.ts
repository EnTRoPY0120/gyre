import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { createCluster } from '$lib/server/clusters';
import { logClusterChange } from '$lib/server/audit';
import type { User } from '$lib/server/db/schema';

export interface ClusterCreateInput {
	name: string;
	description: string;
	kubeconfig: string;
}

type CreateClusterDependencies = {
	createCluster: typeof createCluster;
	logClusterChange: typeof logClusterChange;
};

const defaultDependencies: CreateClusterDependencies = { createCluster, logClusterChange };

export async function createClusterAndLog(
	user: User,
	input: ClusterCreateInput,
	dependencies: CreateClusterDependencies = defaultDependencies
) {
	try {
		const cluster = await dependencies.createCluster({
			name: input.name,
			description: input.description || undefined,
			kubeconfig: input.kubeconfig,
			isLocal: true
		});

		await dependencies.logClusterChange(user, 'create', input.name, {
			clusterId: cluster.id,
			contextCount: cluster.contextCount
		});

		return { success: true, cluster };
	} catch (error) {
		logger.error(error, 'Error creating cluster:');
		if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
			return fail(400, { error: 'A cluster with this name already exists' });
		}
		return fail(500, { error: 'Failed to create cluster' });
	}
}
