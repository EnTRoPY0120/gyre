import { normalizeClusterId } from '$lib/clusters/identity.js';
import { logger } from '../logger.js';

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
