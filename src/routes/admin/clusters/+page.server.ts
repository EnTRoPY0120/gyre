import { logger } from '$lib/server/logger.js';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getAllClustersPaginated,
	createCluster,
	updateCluster,
	deleteCluster,
	testClusterConnection,
	getClusterById
} from '$lib/server/clusters';
import { logClusterChange } from '$lib/server/audit';
import { invalidateDashboardCache } from '$lib/server/dashboard-cache';
import { clearClientPool } from '$lib/server/kubernetes/client.js';
import { parseAdminPagination } from '../pagination';
import { validateClusterCreateInput } from './create-validation';
import {
	getRequiredFormString,
	requireAdminFormUser,
	serializePagination
} from '../server-helpers';
import type { User } from '$lib/server/db/schema';

interface ClusterCreateInput {
	name: string;
	description: string;
	kubeconfig: string;
}

function readClusterCreateInput(formData: FormData): ClusterCreateInput {
	return {
		name: formData.get('name') as string,
		description: formData.get('description') as string,
		kubeconfig: formData.get('kubeconfig') as string
	};
}

async function createClusterAndLog(user: User, input: ClusterCreateInput) {
	try {
		const cluster = await createCluster({
			name: input.name,
			description: input.description || undefined,
			kubeconfig: input.kubeconfig,
			isLocal: true
		});

		await logClusterChange(user, 'create', input.name, {
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

/**
 * Load function for cluster management page
 */
export const load: PageServerLoad = async ({ url }) => {
	// Get pagination and search params from URL
	const pagination = parseAdminPagination(url);

	// Surface errors injected by the request-size middleware via redirect.
	const urlError =
		url.searchParams.get('_error') === 'payload_too_large'
			? 'Request payload is too large. Please reduce the file size and try again.'
			: null;

	// Load paginated clusters
	const page = await getAllClustersPaginated(pagination);

	return {
		urlError,
		...serializePagination(page, 'clusters', (c) => ({
			id: c.id,
			name: c.name,
			description: c.description,
			isActive: c.isActive,
			isLocal: c.isLocal,
			contextCount: c.contextCount,
			lastConnectedAt: c.lastConnectedAt,
			lastError: c.lastError,
			createdAt: c.createdAt
		})),
		...pagination
	};
};

export const actions: Actions = {
	/**
	 * Create a new cluster from kubeconfig
	 */
	create: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const input = readClusterCreateInput(await request.formData());

		const validationError = validateClusterCreateInput(input);
		if (validationError) return fail(validationError.status, { error: validationError.error });

		return createClusterAndLog(user, input);
	},

	/**
	 * Test cluster connection
	 */
	test: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const clusterId = getRequiredFormString(formData, 'clusterId', 'Cluster ID is required');
		if (typeof clusterId !== 'string') return clusterId;

		try {
			const result = await testClusterConnection(clusterId);

			await logClusterChange(user, 'test', result.clusterName, {
				clusterId,
				connected: result.connected,
				error: result.error
			});

			// Return sanitized health check result (omit internal error details)
			return {
				success: result.connected,
				healthCheck: {
					connected: result.connected,
					clusterName: result.clusterName,
					kubernetesVersion: result.kubernetesVersion,
					error: result.error,
					timestamp: result.timestamp,
					checks: result.checks.map((c) => ({
						name: c.name,
						passed: c.passed,
						message: c.message,
						duration: c.duration
					}))
				}
			};
		} catch (error) {
			logger.error(error, 'Error testing connection:');
			return fail(500, { error: 'Failed to test connection' });
		}
	},

	/**
	 * Toggle cluster active state
	 */
	toggle: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const clusterId = getRequiredFormString(formData, 'clusterId', 'Cluster ID is required');
		if (typeof clusterId !== 'string') return clusterId;
		const isActive = formData.get('isActive') === 'true';

		try {
			const updated = await updateCluster(clusterId, { isActive });

			if (updated) {
				clearClientPool(clusterId);
				invalidateDashboardCache(clusterId);
				await logClusterChange(user, 'update', updated.name, { clusterId, isActive });
			}

			return { success: true, isActive };
		} catch (error) {
			logger.error(error, 'Error updating cluster:');
			return fail(500, { error: 'Failed to update cluster' });
		}
	},

	/**
	 * Delete a cluster
	 */
	delete: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const clusterId = getRequiredFormString(formData, 'clusterId', 'Cluster ID is required');
		if (typeof clusterId !== 'string') return clusterId;

		try {
			const existing = await getClusterById(clusterId);
			if (!existing) {
				return fail(404, { error: 'Cluster not found' });
			}

			await deleteCluster(clusterId);
			clearClientPool(clusterId);
			invalidateDashboardCache(clusterId);

			await logClusterChange(user, 'delete', existing.name, { clusterId });

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error deleting cluster:');
			return fail(500, { error: 'Failed to delete cluster' });
		}
	}
};
