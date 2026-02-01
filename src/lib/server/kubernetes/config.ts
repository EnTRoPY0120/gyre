import * as k8s from '@kubernetes/client-node';

export enum ConfigLoadStrategy {
	DEFAULT = 'default',
	ENV = 'env',
	IN_CLUSTER = 'in-cluster'
}

export interface KubeConfigResult {
	config: k8s.KubeConfig;
	strategy: ConfigLoadStrategy;
	source: string;
}

/**
 * Loads kubeconfig with fallback chain:
 * 1. Auto-discover from ~/.kube/config (loadFromDefault)
 * 2. KUBECONFIG environment variable
 * 3. In-cluster config (for running inside K8s)
 */
export function loadKubeConfig(): KubeConfigResult {
	const config = new k8s.KubeConfig();

	try {
		// Strategy 1: Try default config (~/.kube/config)
		config.loadFromDefault();
		return {
			config,
			strategy: ConfigLoadStrategy.DEFAULT,
			source: config.getCurrentContext() || 'default'
		};
	} catch (error) {
		console.warn('Failed to load default kubeconfig, trying fallbacks...', error);
	}

	try {
		// Strategy 2: Try KUBECONFIG environment variable
		const kubeconfigPath = process.env.KUBECONFIG;
		if (kubeconfigPath) {
			config.loadFromFile(kubeconfigPath);
			return {
				config,
				strategy: ConfigLoadStrategy.ENV,
				source: kubeconfigPath
			};
		}
	} catch (error) {
		console.warn('Failed to load kubeconfig from KUBECONFIG env var, trying in-cluster...', error);
	}

	try {
		// Strategy 3: Try in-cluster config
		config.loadFromCluster();
		return {
			config,
			strategy: ConfigLoadStrategy.IN_CLUSTER,
			source: 'in-cluster'
		};
	} catch {
		throw new Error(
			'Failed to load kubeconfig from all sources (default, KUBECONFIG env, in-cluster). ' +
				'Please ensure you have a valid kubeconfig at ~/.kube/config or set KUBECONFIG environment variable.'
		);
	}
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
