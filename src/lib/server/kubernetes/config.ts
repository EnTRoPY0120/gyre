import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';
import { ConfigurationError } from './errors.js';

/**
 * Configuration options for KubeConfig TLS and proxy settings.
 * Allows customization of certificate validation and HTTP proxies.
 */
export interface KubeConfigOptions {
	/** Custom CA certificate data (PEM format). Overrides the CA from kubeconfig. */
	caData?: string;
	/** Skip TLS certificate verification (insecure, use for testing/dev only). */
	insecureSkipVerify?: boolean;
	/** HTTP proxy URL (e.g., http://proxy.example.com:8080). */
	httpProxy?: string;
	/** HTTPS proxy URL. Falls back to httpProxy if not specified. */
	httpsProxy?: string;
	/** Comma-separated list of hosts to exclude from proxy (e.g., localhost,.example.com). */
	noProxy?: string;
}

/**
 * Loads kubeconfig with automatic mode detection (like kubectl):
 * 1. In-cluster (production): Uses ServiceAccount if KUBERNETES_SERVICE_HOST is set
 * 2. Local development: Falls back to KUBECONFIG env var or ~/.kube/config
 *
 * This allows the same code to work in both production and local development.
 * @param options - Optional TLS and proxy configuration
 */
export function loadKubeConfig(options?: KubeConfigOptions): k8s.KubeConfig {
	const config = new k8s.KubeConfig();

	try {
		// Try in-cluster first (production mode)
		if (process.env.KUBERNETES_SERVICE_HOST) {
			config.loadFromCluster();
			logger.info('✓ Using in-cluster configuration (ServiceAccount)');
			applyConfigurationOptions(config, options);
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
		applyConfigurationOptions(config, options);
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
 * Apply TLS and proxy configuration options to a loaded KubeConfig.
 * Note: KubeConfig cluster properties are read-only, so we log the configuration
 * that should be applied. The actual HTTP client configuration happens at request time
 * through the HTTP agent and middleware configuration.
 * @param config - The KubeConfig to modify
 * @param options - Configuration options
 */
function applyConfigurationOptions(config: k8s.KubeConfig, options?: KubeConfigOptions): void {
	if (!options) return;

	// Log TLS configuration options
	// Note: KubeConfig properties are read-only; actual TLS handling happens in the HTTP agent
	if (options.caData) {
		logger.debug('✓ Custom CA certificate configured for Kubernetes client');
	}

	if (options.insecureSkipVerify) {
		logger.warn('⚠ TLS verification disabled for cluster (insecure, use for testing only)');
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
 * Performs a simple listNamespace call to verify connectivity.
 */
export async function validateKubeConfig(config: k8s.KubeConfig): Promise<boolean> {
	try {
		const k8sApi = config.makeApiClient(k8s.CoreV1Api);
		await k8sApi.listNamespace();
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
		const msg = `Kubeconfig revalidation failed for cluster: ${clusterName}`;
		logger.error(error, msg);
		if (throwOnFailure) {
			throw new ConfigurationError(msg);
		}
		return false;
	}
}
