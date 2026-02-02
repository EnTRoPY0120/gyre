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
	contexts: string[];
	currentContext: string;
}

/**
 * Loads kubeconfig with fallback chain:
 * 1. Auto-discover from ~/.kube/config (loadFromDefault)
 * 2. KUBECONFIG environment variable
 * 3. In-cluster config (for running inside K8s)
 *
 * @param contextName Optional name of the context to use. If not provided, the current context is used.
 */
export function loadKubeConfig(contextName?: string): KubeConfigResult {
	const config = new k8s.KubeConfig();

	try {
		// Try to load default config first to get available contexts
		config.loadFromDefault();

		if (contextName && config.getContexts().some((c) => c.name === contextName)) {
			config.setCurrentContext(contextName);
		}

		return {
			config,
			strategy: ConfigLoadStrategy.DEFAULT,
			source: config.getCurrentContext() || 'default',
			contexts: config.getContexts().map((c) => c.name),
			currentContext: config.getCurrentContext()
		};
	} catch (error) {
		console.warn('Failed to load default kubeconfig, trying fallbacks...', error);
	}

	try {
		const kubeconfigPath = process.env.KUBECONFIG;
		if (kubeconfigPath) {
			config.loadFromFile(kubeconfigPath);
			if (contextName && config.getContexts().some((c) => c.name === contextName)) {
				config.setCurrentContext(contextName);
			}
			return {
				config,
				strategy: ConfigLoadStrategy.ENV,
				source: kubeconfigPath,
				contexts: config.getContexts().map((c) => c.name),
				currentContext: config.getCurrentContext()
			};
		}
	} catch (error) {
		console.warn('Failed to load kubeconfig from KUBECONFIG env var, trying in-cluster...', error);
	}

	try {
		config.loadFromCluster();
		return {
			config,
			strategy: ConfigLoadStrategy.IN_CLUSTER,
			source: 'in-cluster',
			contexts: ['in-cluster'],
			currentContext: 'in-cluster'
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
