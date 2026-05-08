import { ADMIN_ROUTE_PREFIXES } from './config.js';

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
	if (ADMIN_ROUTE_PREFIXES.some((p) => path === `${p}/backups/restore`) && method === 'POST') {
		return REQUEST_LIMITS.BACKUP_RESTORE;
	}

	// Cluster creation endpoint - kubeconfig upload
	if (ADMIN_ROUTE_PREFIXES.some((p) => path === `${p}/clusters`) && method === 'POST') {
		return REQUEST_LIMITS.KUBECONFIG_UPLOAD;
	}

	// Default for all other endpoints (JSON APIs and anything unlisted)
	return REQUEST_LIMITS.JSON_API;
}

// Methods that carry a request body and must include a Content-Length header.
// DELETE is excluded: it rarely carries a body and requiring Content-Length
// would break standard DELETE requests.
const _BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Check if request size exceeds limit based on the Content-Length header.
 * Returns { valid: true } or { valid: false, limit, size }.
 *
 * A missing Content-Length header (e.g. chunked/streamed POST/PUT/PATCH) is
 * treated as valid here and falls through to handler-side parsed-body checks.
 *
 * Limitation: Content-Length can be spoofed. Route handlers must enforce
 * size limits on parsed bodies as a second line of defense.
 */
export function validateRequestSize(
	contentLength: string | number | undefined,
	limit: number,
	_method: string
): { valid: true } | { valid: false; limit: number; size: number } {
	if (contentLength == null || contentLength === '') {
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
