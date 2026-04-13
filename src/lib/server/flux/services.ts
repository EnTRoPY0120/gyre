import { error } from '@sveltejs/kit';
import * as k8s from '@kubernetes/client-node';
import {
	getFluxResource,
	getFluxResourceStatus,
	getKubeConfig,
	getPoolMetrics,
	listFluxResources,
	type ListOptions,
	type ReqCache
} from '$lib/server/kubernetes/client.js';
import { validateKubeConfig } from '$lib/server/kubernetes/config.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import {
	getAllResourcePlurals,
	getAllResourceTypes,
	resolveFluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { logger } from '$lib/server/logger.js';
import { getResourceStatus } from '$lib/utils/relationships.js';

export const DEFAULT_FLUX_VERSION = 'v2.x.x';

const MAX_CONNECTION_CACHE_SIZE = 20;
const CONNECTION_CACHE_TTL = 30 * 1000;

const connectionCache = new Map<string, { connected: boolean; timestamp: number }>();

function pruneConnectionCache() {
	const now = Date.now();
	for (const [key, value] of connectionCache.entries()) {
		if (now - value.timestamp > CONNECTION_CACHE_TTL * 10) {
			connectionCache.delete(key);
		}
	}

	if (connectionCache.size > MAX_CONNECTION_CACHE_SIZE) {
		const sorted = [...connectionCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
		sorted
			.slice(0, connectionCache.size - MAX_CONNECTION_CACHE_SIZE)
			.forEach(([key]) => connectionCache.delete(key));
	}
}

export async function getFluxHealthSummary({
	locals,
	includeDetails
}: {
	locals: App.Locals;
	includeDetails: boolean;
}) {
	const selectedCluster = locals.cluster;
	const config = await getKubeConfig(selectedCluster);
	const currentContext = config.getCurrentContext();

	const cacheKey = selectedCluster || 'default';
	const cached = connectionCache.get(cacheKey) || { connected: false, timestamp: 0 };

	let isValid = false;
	if (Date.now() - cached.timestamp < CONNECTION_CACHE_TTL) {
		isValid = cached.connected;
	} else {
		isValid = await validateKubeConfig(config);
		pruneConnectionCache();
		connectionCache.set(cacheKey, { connected: isValid, timestamp: Date.now() });
	}

	if (!isValid) {
		throw error(503, {
			message: 'Unable to connect to Kubernetes cluster'
		});
	}

	if (!includeDetails) {
		return { status: 'healthy' as const };
	}

	const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;

	return {
		status: 'healthy' as const,
		kubernetes: {
			connected: true,
			configStrategy: isInCluster ? 'in-cluster' : 'local-kubeconfig',
			configSource: isInCluster ? 'ServiceAccount' : 'kubeconfig',
			currentContext,
			availableContexts: config.getContexts().map((context) => context.name),
			connectionPool: getPoolMetrics()
		}
	};
}

export async function getFluxInstalledVersion({ locals }: { locals: App.Locals }) {
	try {
		const config = await getKubeConfig(locals.cluster);
		const appsApi = config.makeApiClient(k8s.AppsV1Api);
		const namespace = 'flux-system';

		try {
			const response = await appsApi.listNamespacedDeployment({ namespace });
			const deployments = response.items;

			if (deployments.length > 0) {
				const fluxDeployment = deployments.find(
					(deployment) =>
						deployment.metadata?.labels?.['app.kubernetes.io/part-of'] === 'flux' ||
						deployment.metadata?.name?.includes('source-controller')
				);

				const version =
					fluxDeployment?.metadata?.labels?.['app.kubernetes.io/version'] ||
					deployments[0].metadata?.labels?.['app.kubernetes.io/version'];

				if (version) {
					return { version };
				}
			}

			const coreApi = config.makeApiClient(k8s.CoreV1Api);
			const namespaceResponse = await coreApi.readNamespace({ name: namespace });
			return {
				version:
					namespaceResponse.metadata?.labels?.['app.kubernetes.io/version'] || DEFAULT_FLUX_VERSION
			};
		} catch (err) {
			logger.warn(err, 'Failed to fetch version from deployments, trying fallback:');
			return { version: DEFAULT_FLUX_VERSION };
		}
	} catch (err) {
		handleApiError(err, 'Error fetching Flux version');
	}
}

export async function getFluxOverviewSummary({ locals }: { locals: App.Locals }) {
	const context = locals.cluster;
	const resourceTypes = getAllResourceTypes();
	const reqCache: ReqCache = new Map();

	const results = await Promise.all(
		resourceTypes.map(async (type) => {
			try {
				const data = await listFluxResources(type, context, reqCache);
				const items = data.items || [];

				let healthy = 0;
				let failed = 0;
				let suspended = 0;

				for (const item of items) {
					const status = getResourceStatus(item);
					if (status === 'ready') healthy++;
					else if (status === 'failed') failed++;
					else if (status === 'suspended') suspended++;
				}

				return {
					type,
					total: items.length,
					healthy,
					failed,
					suspended
				};
			} catch (err) {
				logger.warn({ type, err }, 'Failed to list Flux resources for overview');
				return { type, total: 0, healthy: 0, failed: 0, suspended: 0, error: true };
			}
		})
	);

	return {
		timestamp: new Date().toISOString(),
		partialFailure: results.some((result) => result.error),
		results: results.filter((result) => !result.error)
	};
}

export async function listFluxResourcesForType({
	locals,
	query,
	resourceType
}: {
	locals: App.Locals;
	query: ListOptions;
	resourceType: string;
}) {
	const resolvedType = resolveFluxResourceType(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	const reqCache: ReqCache = new Map();

	try {
		const result = await listFluxResources(resolvedType, locals.cluster, reqCache, query);
		return {
			resourceType: resolvedType,
			result
		};
	} catch (err) {
		handleApiError(err, `Error listing ${resolvedType} resources`);
	}
}

export async function getFluxResourceDetail({
	locals,
	name,
	namespace,
	resourceType,
	statusOnly
}: {
	locals: App.Locals;
	name: string;
	namespace: string;
	resourceType: string;
	statusOnly: boolean;
}) {
	const resolvedType = resolveFluxResourceType(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	const reqCache: ReqCache = new Map();

	try {
		const resource = statusOnly
			? await getFluxResourceStatus(resolvedType, namespace, name, locals.cluster, reqCache)
			: await getFluxResource(resolvedType, namespace, name, locals.cluster, reqCache);

		return {
			resource,
			resourceType: resolvedType
		};
	} catch (err) {
		handleApiError(err, `Error fetching ${resolvedType} ${namespace}/${name}`);
	}
}
