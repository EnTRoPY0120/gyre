/**
 * Request size limits for different endpoint types
 * Prevents DoS attacks via large payloads
 */

// Size limits in bytes
export const REQUEST_LIMITS = {
	// General JSON API endpoints
	JSON_API: 1 * 1024 * 1024, // 1 MB

	// Form data with kubeconfig upload
	KUBECONFIG_UPLOAD: 10 * 1024 * 1024, // 10 MB

	// Database backup restoration
	BACKUP_RESTORE: 500 * 1024 * 1024, // 500 MB

	// Default limit for other requests
	DEFAULT: 1 * 1024 * 1024 // 1 MB
};

/**
 * Get the appropriate size limit for a given request path and method
 */
export function getRequestSizeLimit(path: string, method: string): number {
	// Backup restore endpoint - larger limit
	if (path.startsWith('/api/admin/backups/restore') && method === 'POST') {
		return REQUEST_LIMITS.BACKUP_RESTORE;
	}

	// Cluster creation endpoint - kubeconfig upload
	if (path.startsWith('/admin/clusters') && method === 'POST') {
		return REQUEST_LIMITS.KUBECONFIG_UPLOAD;
	}

	// Auth provider creation - large JSON payloads for role mappings
	if (path.startsWith('/api/admin/auth-providers') && method === 'POST') {
		return REQUEST_LIMITS.JSON_API;
	}

	// Default for all other endpoints
	return REQUEST_LIMITS.DEFAULT;
}

/**
 * Check if request size exceeds limit
 * Returns { valid: true } or { valid: false, limit, size }
 */
export function validateRequestSize(
	contentLength: string | number | undefined,
	limit: number
): { valid: boolean; limit?: number; size?: number } {
	if (!contentLength) {
		return { valid: true };
	}

	const size = typeof contentLength === 'string' ? parseInt(contentLength, 10) : contentLength;

	if (!Number.isFinite(size) || size < 0) {
		return { valid: true };
	}

	if (size > limit) {
		return { valid: false, limit, size };
	}

	return { valid: true };
}
