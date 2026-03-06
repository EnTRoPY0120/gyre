import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	getFluxResource,
	getCoreV1Api,
	getAppsV1Api,
	type ReqCache
} from '$lib/server/kubernetes/client.js';
import {
	getResourceTypeByPlural,
	getAllResourcePlurals,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { parseInventory } from '$lib/server/kubernetes/flux/inventory.js';
import { getGenericResource } from '$lib/server/kubernetes/client.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { requirePermission } from '$lib/server/rbac.js';
import type { ResourceHealth, GraphNode } from '$lib/types/view';

export const _metadata = {
	GET: {
		summary: 'Get Kubernetes object tree for a Flux resource',
		description:
			'Returns the full managed object tree for a Kustomization or HelmRelease, including all inventory resources and their live health status. Deployments are expanded to include their ReplicaSets and Pods.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'kustomizations' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-app' })
			})
		},
		responses: {
			200: {
				description: 'Object tree with health status',
				content: { 'application/json': { schema: z.any() } }
			},
			400: { description: 'Invalid resource type or missing cluster context' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			404: { description: 'Resource not found' }
		}
	}
};

const WORKLOAD_KINDS = new Set(['Deployment', 'StatefulSet', 'DaemonSet']);

function getHealthFromConditions(
	conditions: Array<{ type: string; status: string; reason?: string }>,
	suspended?: boolean,
	observedGeneration?: number,
	generation?: number
): ResourceHealth {
	if (suspended) return 'suspended';
	if (!conditions || conditions.length === 0) return 'unknown';

	const stalled = conditions.find((c) => c.type === 'Stalled' || c.type === 'Failed');
	if (stalled?.status === 'True') return 'failed';

	if (
		generation !== undefined &&
		observedGeneration !== undefined &&
		observedGeneration < generation
	) {
		return 'progressing';
	}

	for (const type of ['Ready', 'Healthy', 'Succeeded', 'Available']) {
		const cond = conditions.find((c) => c.type === type);
		if (!cond) continue;
		if (cond.status === 'True') return 'healthy';
		if (cond.status === 'False') {
			if (
				cond.reason === 'Progressing' ||
				cond.reason === 'ProgressingWithRetry' ||
				cond.reason === 'DependencyNotReady'
			)
				return 'progressing';
			return 'failed';
		}
		if (cond.status === 'Unknown') return 'progressing';
	}

	return 'unknown';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWorkloadHealth(resource: any): ResourceHealth {
	if (resource.spec?.suspend) return 'suspended';

	const kind: string = resource.kind || '';
	const status = resource.status || {};
	const conditions = status.conditions || [];

	// Check conditions first
	const h = getHealthFromConditions(
		conditions,
		resource.spec?.suspend,
		status.observedGeneration,
		resource.metadata?.generation
	);
	if (h !== 'unknown') return h;

	// Fallback: replica counts
	if (kind === 'Deployment' || kind === 'StatefulSet') {
		const desired = resource.spec?.replicas ?? status.replicas ?? 0;
		const ready = status.readyReplicas ?? 0;
		if (desired === 0) return 'healthy';
		if (ready >= desired) return 'healthy';
		if (ready > 0) return 'progressing';
		return 'failed';
	}

	if (kind === 'DaemonSet') {
		const desired = status.desiredNumberScheduled ?? 0;
		const ready = status.numberReady ?? 0;
		if (desired === 0) return 'healthy';
		if (ready >= desired) return 'healthy';
		return 'progressing';
	}

	if (kind === 'ReplicaSet') {
		const desired = resource.spec?.replicas ?? 0;
		if (desired === 0) return 'healthy';
		const ready = status.readyReplicas ?? 0;
		return ready >= desired ? 'healthy' : 'progressing';
	}

	if (kind === 'Pod') {
		const phase: string = status.phase || '';
		if (phase === 'Running' || phase === 'Succeeded') return 'healthy';
		if (phase === 'Failed') return 'failed';
		if (phase === 'Pending') return 'progressing';
		return 'unknown';
	}

	return 'unknown';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resourceToNode(resource: any, group: string, version: string): GraphNode {
	const kind: string = resource.kind || 'Unknown';
	const name: string = resource.metadata?.name || '';
	const namespace: string = resource.metadata?.namespace || '';
	const conditions = resource.status?.conditions || [];
	const health = getWorkloadHealth(resource);

	const details: Record<string, unknown> = {};
	if (resource.status?.replicas !== undefined) {
		details.replicas = resource.status.replicas;
		details.readyReplicas = resource.status.readyReplicas ?? 0;
	}
	if (resource.status?.phase) details.phase = resource.status.phase;
	if (resource.metadata?.creationTimestamp) details.createdAt = resource.metadata.creationTimestamp;

	return {
		id: `${namespace}/${kind}/${name}`,
		kind,
		name,
		namespace,
		group,
		version,
		health,
		conditions,
		details,
		children: []
	};
}

/**
 * GET /api/flux/{resourceType}/{namespace}/{name}/tree
 * Returns the full managed Kubernetes object tree for a Kustomization or HelmRelease.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, { message: 'Authentication required' });
	if (!locals.cluster) throw error(400, { message: 'Cluster context required' });

	const { resourceType, namespace, name } = params;

	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Only Kustomizations and HelmReleases have inventory
	if (resolvedType !== 'Kustomization' && resolvedType !== 'HelmRelease') {
		throw error(400, {
			message: 'Object tree is only available for Kustomizations and HelmReleases'
		});
	}

	await requirePermission(locals.user, 'read', resolvedType, namespace, locals.cluster);

	const reqCache: ReqCache = new Map();

	try {
		const root = await getFluxResource(resolvedType, namespace, name, locals.cluster, reqCache);

		const rootConditions = root.status?.conditions || [];
		const rootHealth = getHealthFromConditions(
			rootConditions,
			root.spec?.suspend as boolean | undefined,
			root.status?.observedGeneration,
			root.metadata?.generation
		);

		const rootNode: GraphNode = {
			id: `${namespace}/${resolvedType}/${name}`,
			kind: resolvedType,
			name,
			namespace,
			group:
				resolvedType === 'Kustomization' ? 'kustomize.toolkit.fluxcd.io' : 'helm.toolkit.fluxcd.io',
			version: 'v1',
			health: rootHealth,
			conditions: rootConditions,
			details: {
				revision: root.status?.lastAppliedRevision,
				interval: root.spec?.interval
			},
			children: []
		};

		const inventoryEntries = root.status?.inventory?.entries || [];
		if (inventoryEntries.length === 0) {
			return json({ root: rootNode });
		}

		const parsed = parseInventory(inventoryEntries);
		const capped = parsed.slice(0, 100); // limit to 100 resources

		// Fetch all inventory resources in parallel
		const inventoryResources = await Promise.allSettled(
			capped.map(async (inv) => {
				const res = await getGenericResource(
					inv.group,
					inv.kind,
					inv.namespace,
					inv.name,
					locals.cluster,
					reqCache
				);
				return { inv, res };
			})
		);

		// Collect namespaces that contain workloads for batch listing
		const workloadNamespaces = new Set<string>();
		for (const result of inventoryResources) {
			if (result.status === 'fulfilled') {
				const { inv, res } = result.value;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const resAny = res as any;
				const kind: string = resAny.kind || inv.kind;
				if (WORKLOAD_KINDS.has(kind) && inv.namespace) {
					workloadNamespaces.add(inv.namespace);
				}
			}
		}

		// Batch list ReplicaSets and Pods per namespace
		const replicaSetsByNs = new Map<string, unknown[]>();
		const podsByNs = new Map<string, unknown[]>();

		if (workloadNamespaces.size > 0) {
			const appsApi = await getAppsV1Api(locals.cluster, reqCache);
			const coreApi = await getCoreV1Api(locals.cluster, reqCache);

			await Promise.allSettled(
				[...workloadNamespaces].map(async (ns) => {
					const [rsList, podList] = await Promise.allSettled([
						appsApi.listNamespacedReplicaSet({ namespace: ns }),
						coreApi.listNamespacedPod({ namespace: ns })
					]);

					if (rsList.status === 'fulfilled') {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						replicaSetsByNs.set(ns, (rsList.value as any).items || []);
					}
					if (podList.status === 'fulfilled') {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						podsByNs.set(ns, (podList.value as any).items || []);
					}
				})
			);
		}

		// Build child nodes
		for (const result of inventoryResources) {
			if (result.status !== 'fulfilled') continue;
			const { inv, res } = result.value;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const resAny = res as any;
			const kind: string = resAny.kind || inv.kind;

			const node = resourceToNode(resAny, inv.group, inv.version);

			// Expand workloads → ReplicaSets → Pods
			if (WORKLOAD_KINDS.has(kind) && inv.namespace) {
				const uid: string = resAny.metadata?.uid || '';
				const rsItems = replicaSetsByNs.get(inv.namespace) || [];
				const podItems = podsByNs.get(inv.namespace) || [];

				// Find ReplicaSets owned by this workload
				const ownedRS = rsItems.filter(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(rs: any) =>
						(rs.metadata?.ownerReferences || []).some(
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							(ref: any) => ref.uid === uid
						)
				);

				for (const rs of ownedRS) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const rsAny = rs as any;
					const rsNode = resourceToNode(rsAny, 'apps', 'v1');
					const rsUid: string = rsAny.metadata?.uid || '';

					// Find Pods owned by this ReplicaSet
					const ownedPods = podItems.filter(
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(pod: any) =>
							(pod.metadata?.ownerReferences || []).some(
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								(ref: any) => ref.uid === rsUid
							)
					);

					// Cap pods per ReplicaSet at 10
					for (const pod of ownedPods.slice(0, 10)) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						rsNode.children.push(resourceToNode(pod as any, '', 'v1'));
					}

					node.children.push(rsNode);
				}
			}

			rootNode.children.push(node);
		}

		// Sort children by health (failed first, then progressing, then healthy)
		const healthOrder: Record<ResourceHealth, number> = {
			failed: 0,
			progressing: 1,
			unknown: 2,
			suspended: 3,
			healthy: 4
		};
		rootNode.children.sort((a, b) => healthOrder[a.health] - healthOrder[b.health]);

		return json({ root: rootNode });
	} catch (err) {
		throw handleApiError(
			err,
			`Error fetching object tree for ${resolvedType} ${namespace}/${name}`
		);
	}
};
