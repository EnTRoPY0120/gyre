import { normalizeClusterId } from '$lib/clusters/identity.js';
import * as k8s from '@kubernetes/client-node';
import { logger } from '../logger.js';
import { getCoreV1Api } from './client-pool.js';
import { handleK8sError } from './error-handler.js';

/**
 * Audit log helper for sensitive resource access (e.g., Secrets).
 * Used to track compliance requirements for access to sensitive data.
 * @param operation - Operation type (get, list, create, update, delete, patch)
 * @param resourceType - Resource type (e.g., 'Secret', 'ConfigMap')
 * @param namespace - Namespace of the resource
 * @param name - Name of the resource (optional for list operations)
 * @param context - Cluster context for multi-cluster setups
 *
 * @example
 * // Log access to a Secret
 * auditLogSecretAccess('get', 'Secret', 'default', 'my-secret', 'production');
 * // Output: [AUDIT] GET Secret default/my-secret (context: production) at 2024-03-24T...
 */
export function auditLogSecretAccess(
	operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'patch',
	resourceType: string,
	namespace: string,
	name?: string,
	context?: string
): void {
	const timestamp = new Date().toISOString();
	const resourceId = name ? `${namespace}/${name}` : namespace;
	const msg = `[AUDIT] ${operation.toUpperCase()} ${resourceType} ${resourceId} (context: ${normalizeClusterId(context)}) at ${timestamp}`;

	// Use warn level for sensitive resource access to ensure it's logged to files
	logger.warn(msg);
}

/**
 * Read a Kubernetes Secret (CoreV1 API) with audit logging.
 * @param namespace - Namespace containing the Secret
 * @param name - Name of the Secret
 * @param context - Optional cluster context
 */
export async function readSecret(
	namespace: string,
	name: string,
	context?: string
): Promise<k8s.V1Secret> {
	// Audit log before attempting read (logs both success and failure)
	auditLogSecretAccess('get', 'Secret', namespace, name, context);
	try {
		const api = await getCoreV1Api(context);
		const response = await api.readNamespacedSecret({ namespace, name });
		return response;
	} catch (error) {
		throw handleK8sError(error, `read Secret ${namespace}/${name}`);
	}
}
