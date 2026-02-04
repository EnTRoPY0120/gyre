import * as k8s from '@kubernetes/client-node';

/**
 * Loads kubeconfig from in-cluster ServiceAccount credentials.
 * Gyre must be running as a pod with a valid ServiceAccount.
 */
export function loadKubeConfig(): k8s.KubeConfig {
	const config = new k8s.KubeConfig();
	try {
		config.loadFromCluster();
		return config;
	} catch (error) {
		throw new Error(
			'Failed to load in-cluster configuration. ' +
				'Ensure Gyre is running with a valid ServiceAccount. ' +
				`Error: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Create a kubeconfig from uploaded cluster data
 * Used when loading clusters from the database
 */
export function createKubeConfigFromString(
	kubeconfigYaml: string,
	contextName?: string
): k8s.KubeConfig {
	const config = new k8s.KubeConfig();
	config.loadFromString(kubeconfigYaml);

	if (contextName && config.getContexts().some((c) => c.name === contextName)) {
		config.setCurrentContext(contextName);
	}

	return config;
}

/**
 * Validates that the loaded config can connect to the cluster
 */
export async function validateKubeConfig(config: k8s.KubeConfig): Promise<boolean> {
	try {
		const k8sApi = config.makeApiClient(k8s.CoreV1Api);
		await k8sApi.listNamespace();
		return true;
	} catch (error) {
		console.error('Failed to validate kubeconfig:', error);
		return false;
	}
}
