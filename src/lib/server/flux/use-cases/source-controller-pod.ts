import type * as k8s from '@kubernetes/client-node';

export function getSourceControllerPodName(
	pods: Pick<k8s.V1PodList, 'items'>,
	namespace: string
): string {
	const pod = pods.items?.[0];
	if (!pod) {
		throw new Error(`No source-controller pod found in ${namespace} namespace`);
	}

	const podName = pod.metadata?.name;
	if (!podName) {
		throw new Error('source-controller pod has no name');
	}

	return podName;
}
