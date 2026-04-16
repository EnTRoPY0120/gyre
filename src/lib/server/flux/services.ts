import { error } from '@sveltejs/kit';
import * as k8s from '@kubernetes/client-node';
import { IN_CLUSTER_ID, normalizeClusterId } from '$lib/clusters/identity.js';
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

function getK8sStatusCode(err: unknown): number | undefined {
	if (typeof err !== 'object' || err === null) {
		return undefined;
	}

	const candidate = err as {
		code?: unknown;
		response?: { statusCode?: unknown };
		status?: unknown;
	};
	const parseStatus = (value: unknown): number | undefined => {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'string' && /^\d+$/.test(value)) {
			return Number(value);
		}
		return undefined;
	};

	const code = parseStatus(candidate.code);
	if (code !== undefined) {
		return code;
	}
	const responseCode = parseStatus(candidate.response?.statusCode);
	if (responseCode !== undefined) {
		return responseCode;
	}
	const status = parseStatus(candidate.status);
	if (status !== undefined) {
		return status;
	}
	return undefined;
}

function isNotFoundError(err: unknown): boolean {
	return getK8sStatusCode(err) === 404;
}

function ensureResolvedFluxResourceType(resourceType: string) {
	const resolvedType = resolveFluxResourceType(resourceType);
	if (!resolvedType) {
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${getAllResourcePlurals().join(', ')}`
		});
	}
	return resolvedType;
}

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
	try {
		const selectedCluster = normalizeClusterId(locals.cluster);
		const config = await getKubeConfig(selectedCluster);
		const currentContext = config.getCurrentContext();

		const cacheKey = selectedCluster ?? IN_CLUSTER_ID;
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
	} catch (err) {
		handleApiError(err, 'Error fetching Flux health summary');
	}
}

export async function getFluxInstalledVersion({ locals }: { locals: App.Locals }) {
	try {
		const config = await getKubeConfig(locals.cluster);
		const appsApi = config.makeApiClient(k8s.AppsV1Api);
		const namespace = 'flux-system';
		const coreApi = config.makeApiClient(k8s.CoreV1Api);

		let deployments: k8s.V1Deployment[] = [];
		try {
			const response = await appsApi.listNamespacedDeployment({ namespace });
			deployments = response.items ?? [];
		} catch (err) {
			if (isNotFoundError(err)) {
				logger.warn({ err }, 'Flux namespace/deployments not found; using default Flux version');
				return { version: DEFAULT_FLUX_VERSION };
			}
			logger.warn({ err }, 'Failed to list Flux deployments');
			throw err;
		}

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

		try {
			const namespaceResponse = await coreApi.readNamespace({ name: namespace });
			return {
				version:
					namespaceResponse.metadata?.labels?.['app.kubernetes.io/version'] || DEFAULT_FLUX_VERSION
			};
		} catch (err) {
			if (isNotFoundError(err)) {
				logger.warn({ err }, 'Flux namespace not found while reading version label');
				return { version: DEFAULT_FLUX_VERSION };
			}
			logger.warn({ err }, 'Failed to read Flux namespace while determining version');
			throw err;
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
	const resolvedType = ensureResolvedFluxResourceType(resourceType);

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
	const resolvedType = ensureResolvedFluxResourceType(resourceType);

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
