import { logger } from '$lib/server/logger.js';
import yaml from 'js-yaml';
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
import { REQUEST_LIMITS, formatSize } from '$lib/server/request-limits';
import { parseAdminPagination } from '../pagination';
import {
	getRequiredFormString,
	requireAdminFormUser,
	serializePagination,
	validateLength
} from '../server-helpers';

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

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const kubeconfig = formData.get('kubeconfig') as string;

		// Validation
		if (!name || !kubeconfig) {
			return fail(400, { error: 'Name and kubeconfig are required' });
		}

		const nameLengthError = validateLength(name, {
			min: 3,
			max: 100,
			minMessage: 'Name must be at least 3 characters',
			maxMessage: 'Name must be at most 100 characters'
		});
		if (nameLengthError) return nameLengthError;

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
			// Validate kubeconfig format (accepts both YAML and JSON)
			const parsed = yaml.load(kubeconfig);
			if (
				parsed === null ||
				parsed === undefined ||
				typeof parsed !== 'object' ||
				!(parsed as { clusters?: unknown }).clusters ||
				!(parsed as { contexts?: unknown }).contexts
			) {
				return fail(400, { error: 'Invalid kubeconfig: missing clusters or contexts' });
			}

			const config = parsed as {
				clusters?: unknown;
				contexts?: unknown;
				kind?: unknown;
				apiVersion?: unknown;
			};
			if (config.kind !== 'Config' || config.apiVersion !== 'v1') {
				return fail(400, {
					error: 'Invalid kubeconfig: must have kind: Config and apiVersion: v1'
				});
			}

			if (!Array.isArray(config.clusters) || !Array.isArray(config.contexts)) {
				return fail(400, {
					error: 'Invalid kubeconfig: clusters and contexts must be arrays'
				});
			}

			// Create cluster
			const cluster = await createCluster({
				name,
				description: description || undefined,
				kubeconfig,
				isLocal: true
			});

			await logClusterChange(user, 'create', name, {
				clusterId: cluster.id,
				contextCount: cluster.contextCount
			});

			return { success: true, cluster };
		} catch (error) {
			logger.error(error, 'Error creating cluster:');
			if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'A cluster with this name already exists' });
			}
			if (error instanceof yaml.YAMLException) {
				return fail(400, { error: 'Invalid kubeconfig format: could not parse as YAML or JSON' });
			}
			return fail(500, { error: 'Failed to create cluster' });
		}
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
