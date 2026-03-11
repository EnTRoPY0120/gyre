/**
 * Request size limits for different endpoint types
 * Prevents DoS attacks via large payloads
 */

// Size limits in bytes
export const REQUEST_LIMITS = {
	// General JSON API endpoints
	JSON_API: 1 * 1024 * 1024, // 1 MB

	// Form data with kubeconfig upload (10MB covers realistic kubeconfig files;
	// typical files are <100KB but OIDC/multi-cluster configs can reach several MB)
	KUBECONFIG_UPLOAD: 10 * 1024 * 1024, // 10 MB

	// Database backup restoration
	BACKUP_RESTORE: 500 * 1024 * 1024, // 500 MB

	// Default limit for other requests
	DEFAULT: 1 * 1024 * 1024 // 1 MB
};

/**
 * Get the appropriate size limit for a given request path and method.
 *
 * NOTE: When adding new endpoints with non-default size limits, add a matching
 * path check here. Unlisted endpoints fall back to REQUEST_LIMITS.DEFAULT (1MB).
 * Use exact path matches (===) to avoid silently applying a larger limit to
 * future sub-routes (e.g. /admin/clusters/delete).
 */
export function getRequestSizeLimit(path: string, method: string): number {
	// Backup restore endpoint - larger limit
	if (
		(path === '/api/admin/backups/restore' || path === '/api/v1/admin/backups/restore') &&
		method === 'POST'
	) {
		return REQUEST_LIMITS.BACKUP_RESTORE;
	}

	// Cluster creation endpoint - kubeconfig upload
	if ((path === '/admin/clusters' || path === '/api/v1/admin/clusters') && method === 'POST') {
		return REQUEST_LIMITS.KUBECONFIG_UPLOAD;
	}

	// Default for all other endpoints (JSON APIs and anything unlisted)
	return REQUEST_LIMITS.JSON_API;
}

/**
 * Check if request size exceeds limit based on the Content-Length header.
 * Returns { valid: true } or { valid: false, limit, size }.
 *
 * Limitation: Content-Length is optional in HTTP and absent for chunked
 * transfer-encoded requests. When the header is missing this function
 * allows the request through — the route handler is responsible for
 * enforcing size limits on the parsed body in those cases (e.g. checking
 * File.size after formData() for uploads, or body byte length after json()).
 */
export function validateRequestSize(
	contentLength: string | number | undefined,
	limit: number
): { valid: true } | { valid: false; limit: number; size: number } {
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

/**
 * Format a byte count as a human-readable string.
 * Uses one decimal place and strips trailing ".0" for clean output.
 */
export function formatSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	}
	if (bytes < 1024 * 1024) {
		return `${parseFloat((bytes / 1024).toFixed(1))}KB`;
	}
	return `${parseFloat((bytes / (1024 * 1024)).toFixed(1))}MB`;
}
