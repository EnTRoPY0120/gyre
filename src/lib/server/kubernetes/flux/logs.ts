import { getResourceDef, getResourceTypeByPlural } from './resources.js';
import { getCoreV1Api } from '../client-pool.js';
import type { ReqCache } from '../kubeconfig-provider.js';
import { handleK8sError } from '../error-handler.js';
import { OPERATION_TIMEOUTS } from '../timeouts.js';
import type { CoreV1Api } from '@kubernetes/client-node';

function getControllerName(resourceType: string): string {
	const resourceDef =
		getResourceDef(resourceType) ?? getResourceDef(getResourceTypeByPlural(resourceType) ?? '');
	if (!resourceDef) throw new Error(`Unknown resource type: ${resourceType}`);
	return resourceDef.controller;
}

async function findControllerPod(coreApi: CoreV1Api, controllerName: string): Promise<string> {
	const primaryResponse = await coreApi.listNamespacedPod({
		namespace: 'flux-system',
		labelSelector: `app=${controllerName}`
	});
	let pods = primaryResponse.items;

	if (pods.length === 0) {
		const fallbackResponse = await coreApi.listNamespacedPod({
			namespace: 'flux-system',
			labelSelector: `app.kubernetes.io/name=${controllerName}`
		});
		if (fallbackResponse.items.length === 0) {
			throw new Error(`No pods found for controller ${controllerName} in namespace flux-system`);
		}
		pods = fallbackResponse.items;
	}

	const pod = pods.find((candidate) => candidate.status?.phase === 'Running') ?? pods[0];
	const podName = pod.metadata?.name;
	if (!podName) throw new Error(`Could not determine pod name for controller ${controllerName}`);
	return podName;
}

function filterResourceLogs(
	logs: string,
	resourceType: string,
	namespace: string,
	name: string
): string {
	const filteredLines = logs.split('\n').filter((line) => {
		if (!line.trim()) return false;
		return line.includes(`"${name}"`) && line.includes(`"${namespace}"`);
	});

	return filteredLines.length > 0
		? filteredLines.join('\n')
		: `No controller log lines matched ${resourceType} ${namespace}/${name}.`;
}

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
	const controllerName = getControllerName(resourceType);

	try {
		const coreApi = await getCoreV1Api(context, reqCache, OPERATION_TIMEOUTS.logs);
		const podName = await findControllerPod(coreApi, controllerName);

		// 2. Fetch logs (last 500 lines)
		const logsResponse = await coreApi.readNamespacedPodLog({
			name: podName,
			namespace: 'flux-system',
			tailLines: 1000
		});

		return filterResourceLogs(logsResponse, resourceType, namespace, name);
	} catch (error) {
		throw handleK8sError(error, `fetch logs for ${controllerName}`, OPERATION_TIMEOUTS.logs);
	}
}
