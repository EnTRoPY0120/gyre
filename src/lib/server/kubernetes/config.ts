import * as k8s from '@kubernetes/client-node';

/**
 * Loads kubeconfig with automatic mode detection (like kubectl):
 * 1. In-cluster (production): Uses ServiceAccount if KUBERNETES_SERVICE_HOST is set
 * 2. Local development: Falls back to KUBECONFIG env var or ~/.kube/config
 *
 * This allows the same code to work in both production and local development.
 */
export function loadKubeConfig(): k8s.KubeConfig {
	const config = new k8s.KubeConfig();

	try {
		// Try in-cluster first (production mode)
		if (process.env.KUBERNETES_SERVICE_HOST) {
			config.loadFromCluster();
			console.log('✓ Using in-cluster configuration (ServiceAccount)');
			return config;
		}
	} catch (error) {
		console.warn('Failed to load in-cluster config, trying local kubeconfig...', error);
	}

	try {
		// Fall back to local kubeconfig (development mode)
		// Tries: $KUBECONFIG, then ~/.kube/config
		config.loadFromDefault();
		console.log('✓ Using local kubeconfig for development');
		return config;
	} catch (error) {
		throw new Error(
			'Failed to load Kubernetes configuration. ' +
				'For production: Ensure running in a pod with ServiceAccount. ' +
				'For development: Set KUBECONFIG or create ~/.kube/config. ' +
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
