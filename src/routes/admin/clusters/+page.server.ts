import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getAllClustersPaginated,
	createCluster,
	updateCluster,
	deleteCluster,
	testClusterConnection
} from '$lib/server/clusters';
import { isAdmin } from '$lib/server/rbac';
import { logClusterChange } from '$lib/server/audit';

/**
 * Load function for cluster management page
 */
export const load: PageServerLoad = async ({ url }) => {
	// Get pagination and search params from URL
	const search = url.searchParams.get('search') || '';
	const limitParam = parseInt(url.searchParams.get('limit') || '10');
	const offsetParam = parseInt(url.searchParams.get('offset') || '0');
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 10;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	// Load paginated clusters
	const { clusters, total } = await getAllClustersPaginated({ search, limit, offset });

	return {
		clusters: clusters.map((c) => ({
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
		total,
		search,
		limit,
		offset
	};
};

export const actions: Actions = {
	/**
	 * Create a new cluster from kubeconfig
	 */
	create: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const kubeconfig = formData.get('kubeconfig') as string;

		// Validation
		if (!name || !kubeconfig) {
			return fail(400, { error: 'Name and kubeconfig are required' });
		}

		if (name.length < 3) {
			return fail(400, { error: 'Name must be at least 3 characters' });
		}

		try {
			// Validate kubeconfig format
			const parsed = JSON.parse(kubeconfig);
			if (!parsed.clusters || !parsed.contexts) {
				return fail(400, { error: 'Invalid kubeconfig: missing clusters or contexts' });
			}

			// Create cluster
			const cluster = await createCluster({
				name,
				description: description || undefined,
				kubeconfig,
				isLocal: true
			});

			await logClusterChange(locals.user, 'create', name, {
				clusterId: cluster.id,
				contextCount: cluster.contextCount
			});

			return { success: true, cluster };
		} catch (error) {
			console.error('Error creating cluster:', error);
			if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'A cluster with this name already exists' });
			}
			if (error instanceof SyntaxError) {
				return fail(400, { error: 'Invalid JSON format in kubeconfig' });
			}
			return fail(500, { error: 'Failed to create cluster' });
		}
	},

	/**
	 * Test cluster connection
	 */
	test: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const clusterId = formData.get('clusterId') as string;

		if (!clusterId) {
			return fail(400, { error: 'Cluster ID is required' });
		}

		try {
			const result = await testClusterConnection(clusterId);

			await logClusterChange(locals.user, 'test', result.clusterName, {
				clusterId,
				connected: result.connected,
				error: result.error
			});

			// Return the detailed health check result
			return {
				success: result.connected,
				healthCheck: result
			};
		} catch (error) {
			console.error('Error testing connection:', error);
			return fail(500, { error: 'Failed to test connection' });
		}
	},

	/**
	 * Toggle cluster active state
	 */
	toggle: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const clusterId = formData.get('clusterId') as string;
		const isActive = formData.get('isActive') === 'true';

		if (!clusterId) {
			return fail(400, { error: 'Cluster ID is required' });
		}

		try {
			const updated = await updateCluster(clusterId, { isActive });

			if (updated) {
				await logClusterChange(locals.user, 'update', updated.name, { clusterId, isActive });
			}

			return { success: true, isActive };
		} catch (error) {
			console.error('Error updating cluster:', error);
			return fail(500, { error: 'Failed to update cluster' });
		}
	},

	/**
	 * Delete a cluster
	 */
	delete: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const clusterId = formData.get('clusterId') as string;
		const clusterName = formData.get('clusterName') as string;

		if (!clusterId) {
			return fail(400, { error: 'Cluster ID is required' });
		}

		try {
			await deleteCluster(clusterId);

			await logClusterChange(locals.user, 'delete', clusterName || 'unknown', { clusterId });

			return { success: true };
		} catch (error) {
			console.error('Error deleting cluster:', error);
			return fail(500, { error: 'Failed to delete cluster' });
		}
	}
};
