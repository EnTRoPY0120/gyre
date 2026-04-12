import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';
import { ConfigurationError } from './errors.js';

/**
 * @deprecated Compatibility shim only. Gyre does not support transport-layer
 * overrides through this interface.
 *
 * Any non-empty override (or `insecureSkipVerify: true`) will throw
 * `ConfigurationError`.
 */
export interface KubeConfigOptions {
	/**
	 * @deprecated Compatibility shim only. Any non-empty value will throw
	 * `ConfigurationError`.
	 */
	caData?: string;
	/**
	 * @deprecated Compatibility shim only. Setting this to `true` will throw
	 * `ConfigurationError`.
	 */
	insecureSkipVerify?: boolean;
	/**
	 * @deprecated Compatibility shim only. Any non-empty value will throw
	 * `ConfigurationError`.
	 */
	httpProxy?: string;
	/**
	 * @deprecated Compatibility shim only. Any non-empty value will throw
	 * `ConfigurationError`.
	 */
	httpsProxy?: string;
	/**
	 * @deprecated Compatibility shim only. Any non-empty value will throw
	 * `ConfigurationError`.
	 */
	noProxy?: string;
}

/**
 * Reject unsupported kube transport overrides with a deterministic configuration error.
 */
export function assertSupportedKubeConfigOptions(options?: KubeConfigOptions): void {
	if (!options) {
		return;
	}

	const rejected: Array<keyof KubeConfigOptions> = [];
	if (typeof options.caData === 'string' && options.caData.trim() !== '') {
		rejected.push('caData');
	}
	if (options.insecureSkipVerify === true) {
		rejected.push('insecureSkipVerify');
	}
	if (typeof options.httpProxy === 'string' && options.httpProxy.trim() !== '') {
		rejected.push('httpProxy');
	}
	if (typeof options.httpsProxy === 'string' && options.httpsProxy.trim() !== '') {
		rejected.push('httpsProxy');
	}
	if (typeof options.noProxy === 'string' && options.noProxy.trim() !== '') {
		rejected.push('noProxy');
	}

	if (rejected.length > 0) {
		throw new ConfigurationError(
			`Unsupported kube connectivity override option(s): ${rejected.join(
				', '
			)}. Gyre currently supports only kubeconfig-provided / in-cluster connectivity settings.`
		);
	}
}

/**
 * Loads kubeconfig with automatic mode detection (like kubectl):
 * 1. In-cluster (production): Uses ServiceAccount if KUBERNETES_SERVICE_HOST is set
 * 2. Local development: Falls back to KUBECONFIG env var or ~/.kube/config
 *
 * This allows the same code to work in both production and local development.
 * Transport-layer overrides are not supported: any non-empty override (or
 * `insecureSkipVerify: true`) is rejected with `ConfigurationError`.
 *
 * @param options - Compatibility shim for legacy callers; populated transport
 * overrides will throw.
 */
export function loadKubeConfig(options?: KubeConfigOptions): k8s.KubeConfig {
	const config = new k8s.KubeConfig();
	assertSupportedKubeConfigOptions(options);

	try {
		// Try in-cluster first (production mode)
		if (process.env.KUBERNETES_SERVICE_HOST) {
			config.loadFromCluster();
			logger.info('✓ Using in-cluster configuration (ServiceAccount)');
			return config;
		}
	} catch (error) {
		logger.warn(error, 'Failed to load in-cluster config, trying local kubeconfig...');
	}

	try {
		// Fall back to local kubeconfig (development mode)
		// Tries: $KUBECONFIG, then ~/.kube/config
		config.loadFromDefault();
		logger.info('✓ Using local kubeconfig for development');
		return config;
	} catch (error) {
		throw new ConfigurationError(
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
 * Validates that the loaded config can connect to the cluster.
 * Performs a namespace-scoped probe (list pods) to verify connectivity without
 * requiring cluster-scoped RBAC permissions. Falls back to "default" namespace
 * if the current context doesn't specify one.
 */
export async function validateKubeConfig(config: k8s.KubeConfig): Promise<boolean> {
	try {
		const k8sApi = config.makeApiClient(k8s.CoreV1Api);

		// Get namespace from current context object (fall back to "default")
		const contextObj = config.getContextObject(config.getCurrentContext());
		const namespace = contextObj?.namespace || 'default';

		// Use namespace-scoped probe to avoid requiring cluster-scoped RBAC
		await k8sApi.listNamespacedPod({ namespace });
		return true;
	} catch (error) {
		logger.error(error, 'Failed to validate kubeconfig');
		return false;
	}
}

/**
 * Re-validates the kubeconfig by attempting to connect to the cluster.
 * This is useful for detecting if kubeconfig files have been rotated,
 * certificates have been renewed, or cluster connectivity has changed.
 *
 * @param config - The KubeConfig to validate
 * @param throwOnFailure - If true, throws an error on validation failure
 * @returns true if validation succeeds, false otherwise
 */
export async function revalidateKubeConfig(
	config: k8s.KubeConfig,
	throwOnFailure = false
): Promise<boolean> {
	const clusterName = config.getCurrentCluster()?.name || 'unknown';
	try {
		const isValid = await validateKubeConfig(config);
		if (isValid) {
			logger.debug(`✓ Kubeconfig revalidation successful for cluster: ${clusterName}`);
			return true;
		} else {
			const msg = `Kubeconfig validation failed for cluster: ${clusterName}`;
			logger.warn(msg);
			if (throwOnFailure) {
				throw new ConfigurationError(msg);
			}
			return false;
		}
	} catch (error) {
		// Rethrow ConfigurationError immediately without wrapping
		if (error instanceof ConfigurationError) {
			throw error;
		}

		const msg = `Kubeconfig revalidation failed for cluster: ${clusterName}`;
		logger.error(error, msg);
		if (throwOnFailure) {
			throw new ConfigurationError(msg);
		}
		return false;
	}
}
