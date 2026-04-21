import { getResourceDef, getResourceTypeByPlural } from './resources.js';
import { getCoreV1Api } from '../client-pool.js';
import type { ReqCache } from '../kubeconfig-provider.js';
import { handleK8sError } from '../error-handler.js';
import { OPERATION_TIMEOUTS } from '../timeouts.js';

/**
 * Get logs for a FluxCD controller responsible for a specific resource
 */
export async function getControllerLogs(
	resourceType: string,
	namespace: string,
	name: string,
	context?: string,
	reqCache?: ReqCache
): Promise<string> {
	let resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		const key = getResourceTypeByPlural(resourceType);
		if (key) {
			resourceDef = getResourceDef(key);
		}
	}

	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const controllerName = resourceDef.controller;

	try {
		const coreApi = await getCoreV1Api(context, reqCache, OPERATION_TIMEOUTS.logs);
		// 1. Find the controller pod in flux-system namespace
		// Most Flux installations use the app label
		const podsResponse = await coreApi.listNamespacedPod({
			namespace: 'flux-system',
			labelSelector: `app=${controllerName}`
		});

		const pods = podsResponse.items;
		if (pods.length === 0) {
			// Fallback: try app.kubernetes.io/name label
			const podsResponseAlt = await coreApi.listNamespacedPod({
				namespace: 'flux-system',
				labelSelector: `app.kubernetes.io/name=${controllerName}`
			});
			if (podsResponseAlt.items.length === 0) {
				throw new Error(`No pods found for controller ${controllerName} in namespace flux-system`);
			}
			pods.push(...podsResponseAlt.items);
		}

		// Pick the first running pod
		const pod = pods.find((p) => p.status?.phase === 'Running') || pods[0];
		const podName = pod.metadata?.name;

		if (!podName) {
			throw new Error(`Could not determine pod name for controller ${controllerName}`);
		}

		// 2. Fetch logs (last 500 lines)
		const logsResponse = await coreApi.readNamespacedPodLog({
			name: podName,
			namespace: 'flux-system',
			tailLines: 1000
		});

		const logs = logsResponse;

		// 3. Filter logs for the specific resource
		// Flux logs are JSON and typically contain "name" and "namespace" fields for the resource being processed.
		// We grep for both to be as specific as possible.
		const lines = logs.split('\n');
		const filteredLines = lines.filter((line) => {
			if (!line.trim()) return false;
			// Match both name and namespace of the resource
			return line.includes(`"${name}"`) && line.includes(`"${namespace}"`);
		});

		// If filtering yields too little, return more context or all logs
		if (filteredLines.length < 10) {
			return logs;
		}

		return filteredLines.join('\n');
	} catch (error) {
		throw handleK8sError(error, `fetch logs for ${controllerName}`, OPERATION_TIMEOUTS.logs);
	}
}
