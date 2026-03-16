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
import { isAdmin } from '$lib/server/rbac';
import { logClusterChange } from '$lib/server/audit';
import { REQUEST_LIMITS, formatSize } from '$lib/server/request-limits';

/**
 * Load function for cluster management page
 */
export const load: PageServerLoad = async ({ url }) => {
	// Get pagination and search params from URL
	const search = url.searchParams.get('search') || '';
	const limitParam = parseInt(url.searchParams.get('limit') || '10');
	const offsetParam = parseInt(url.searchParams.get('offset') || '0');
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 10;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	// Surface errors injected by the request-size middleware via redirect.
	const urlError =
		url.searchParams.get('_error') === 'payload_too_large'
			? 'Request payload is too large. Please reduce the file size and try again.'
			: null;

	// Load paginated clusters
	const { clusters, total } = await getAllClustersPaginated({ search, limit, offset });

	return {
		urlError,
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

		if (name.length > 100) {
			return fail(400, { error: 'Name must be at most 100 characters' });
		}

		if (description && description.length > 500) {
			return fail(400, { error: 'Description must be at most 500 characters' });
		}

		// Validate kubeconfig size (max 10MB).
		// This check is the fallback for requests where Content-Length was absent
		// (e.g. chunked transfer encoding) and the middleware passed them through.
		// When Content-Length IS present the middleware rejects oversized requests
		// first and redirects back to this page, so this code is not reached.
		// Note: the middleware measures the total multipart body (including boundary
		// overhead and other fields) while TextEncoder measures the kubeconfig field
		// alone. The two thresholds differ slightly, but multipart overhead is
		// negligible relative to the 10MB limit.
		const kubeconfigSize = new TextEncoder().encode(kubeconfig).length;
		if (kubeconfigSize > REQUEST_LIMITS.KUBECONFIG_UPLOAD) {
			return fail(413, {
				error: `Kubeconfig is too large. Maximum size is ${formatSize(REQUEST_LIMITS.KUBECONFIG_UPLOAD)}, received ${formatSize(kubeconfigSize)}`
			});
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
			logger.error(error, 'Error creating cluster:');
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

			// Return sanitized health check result (omit internal error details)
			return {
				success: result.connected,
				healthCheck: {
					connected: result.connected,
					clusterName: result.clusterName,
					kubernetesVersion: result.kubernetesVersion,
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
			logger.error(error, 'Error updating cluster:');
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

		if (!clusterId) {
			return fail(400, { error: 'Cluster ID is required' });
		}

		const existing = await getClusterById(clusterId);
		if (!existing) {
			return fail(404, { error: 'Cluster not found' });
		}

		try {
			await deleteCluster(clusterId);

			await logClusterChange(locals.user, 'delete', existing.name, { clusterId });

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error deleting cluster:');
			return fail(500, { error: 'Failed to delete cluster' });
		}
	}
};
