import { existsSync } from 'node:fs';
import { env } from 'node:process';

/**
 * Deployment modes for Gyre
 * - local: Running as a binary on user's machine, uses kubeconfig
 * - in-cluster: Running as a pod in Kubernetes, uses ServiceAccount
 */
export type DeploymentMode = 'local' | 'in-cluster';

const IN_CLUSTER_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const IN_CLUSTER_CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

/**
 * Auto-detect deployment mode based on environment
 * Priority:
 * 1. GYRE_MODE environment variable (explicit override)
 * 2. Presence of in-cluster Kubernetes service account files
 * 3. Default to 'local'
 */
export function detectDeploymentMode(): DeploymentMode {
	// Check for explicit override
	const explicitMode = env.GYRE_MODE;
	if (explicitMode === 'local' || explicitMode === 'in-cluster') {
		return explicitMode;
	}

	// Auto-detect: check for in-cluster service account token
	if (existsSync(IN_CLUSTER_TOKEN_PATH) && existsSync(IN_CLUSTER_CA_PATH)) {
		return 'in-cluster';
	}

	// Default to local mode
	return 'local';
}

/**
 * Cached deployment mode (computed once on first access)
 */
let cachedMode: DeploymentMode | null = null;

/**
 * Get the current deployment mode
 * Uses caching to avoid repeated file system checks
 */
export function getDeploymentMode(): DeploymentMode {
	if (!cachedMode) {
		cachedMode = detectDeploymentMode();
		console.log(`[Gyre] Running in ${cachedMode} mode`);
	}
	return cachedMode;
}

/**
 * Check if running in local mode
 */
export function isLocalMode(): boolean {
	return getDeploymentMode() === 'local';
}

/**
 * Check if running in-cluster mode
 */
export function isInClusterMode(): boolean {
	return getDeploymentMode() === 'in-cluster';
}

/**
 * Reset the cached mode (useful for testing)
 */
export function resetDeploymentMode(): void {
	cachedMode = null;
}

/**
 * Get in-cluster configuration paths
 * Only valid when in in-cluster mode
 */
export function getInClusterPaths() {
	return {
		tokenPath: IN_CLUSTER_TOKEN_PATH,
		caPath: IN_CLUSTER_CA_PATH,
		namespacePath: '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
	};
}
