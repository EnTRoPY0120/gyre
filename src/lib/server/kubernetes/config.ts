import * as k8s from '@kubernetes/client-node';
import { isLocalMode, isInClusterMode, getDeploymentMode, type DeploymentMode } from '../mode.js';

export enum ConfigLoadStrategy {
	DEFAULT = 'default',
	ENV = 'env',
	IN_CLUSTER = 'in-cluster',
	DATABASE = 'database' // For uploaded kubeconfigs
}

export interface KubeConfigResult {
	config: k8s.KubeConfig;
	strategy: ConfigLoadStrategy;
	source: string;
	contexts: string[];
	currentContext: string;
	deploymentMode: DeploymentMode;
}

/**
 * Loads kubeconfig based on deployment mode:
 *
 * IN-CLUSTER MODE:
 * - Uses loadFromCluster() to get ServiceAccount credentials
 * - No kubeconfig file needed
 *
 * LOCAL MODE:
 * - Tries ~/.kube/config (loadFromDefault)
 * - Falls back to KUBECONFIG env var
 * - Uploaded kubeconfigs from database (managed via UI)
 *
 * @param contextName Optional name of the context to use
 * @param kubeconfigYaml Optional kubeconfig YAML content (for database-loaded configs)
 */
export function loadKubeConfig(contextName?: string, kubeconfigYaml?: string): KubeConfigResult {
	const mode = getDeploymentMode();
	const config = new k8s.KubeConfig();

	// IN-CLUSTER MODE: Use ServiceAccount
	if (isInClusterMode()) {
		try {
			config.loadFromCluster();
			return {
				config,
				strategy: ConfigLoadStrategy.IN_CLUSTER,
				source: 'in-cluster',
				contexts: ['in-cluster'],
				currentContext: 'in-cluster',
				deploymentMode: mode
			};
		} catch (error) {
			throw new Error(
				'Failed to load in-cluster configuration. ' +
					'Ensure Gyre is running with a valid ServiceAccount. ' +
					`Error: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// LOCAL MODE: Try various kubeconfig sources

	// 1. If kubeconfig YAML provided (from database), use it
	if (kubeconfigYaml) {
		try {
			config.loadFromString(kubeconfigYaml);
			if (contextName && config.getContexts().some((c) => c.name === contextName)) {
				config.setCurrentContext(contextName);
			}
			return {
				config,
				strategy: ConfigLoadStrategy.DATABASE,
				source: 'database',
				contexts: config.getContexts().map((c) => c.name),
				currentContext: config.getCurrentContext(),
				deploymentMode: mode
			};
		} catch (error) {
			console.warn('Failed to load kubeconfig from database, trying local files...', error);
		}
	}

	// 2. Try default kubeconfig file
	try {
		config.loadFromDefault();
		if (contextName && config.getContexts().some((c) => c.name === contextName)) {
			config.setCurrentContext(contextName);
		}
		return {
			config,
			strategy: ConfigLoadStrategy.DEFAULT,
			source: config.getCurrentContext() || 'default',
			contexts: config.getContexts().map((c) => c.name),
			currentContext: config.getCurrentContext(),
			deploymentMode: mode
		};
	} catch (error) {
		console.warn('Failed to load default kubeconfig, trying fallbacks...', error);
	}

	// 3. Try KUBECONFIG environment variable
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
				currentContext: config.getCurrentContext(),
				deploymentMode: mode
			};
		}
	} catch (error) {
		console.warn('Failed to load kubeconfig from KUBECONFIG env var', error);
	}

	// If all attempts failed
	throw new Error(
		'Failed to load kubeconfig from all sources. ' +
			'Please ensure you have:\n' +
			'1. A valid kubeconfig at ~/.kube/config, OR\n' +
			'2. KUBECONFIG environment variable set, OR\n' +
			'3. Upload a kubeconfig via the UI (Clusters page)'
	);
}

/**
 * Create a kubeconfig from uploaded cluster data
 * Used when loading clusters from the database in local mode
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

/**
 * Get the current deployment mode (convenience export)
 */
export { getDeploymentMode, isLocalMode, isInClusterMode, type DeploymentMode };
