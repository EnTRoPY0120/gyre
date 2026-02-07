import { error } from '@sveltejs/kit';

/**
 * Custom error types for Kubernetes operations
 */

export class KubernetesError extends Error {
	constructor(
		message: string,
		public readonly code: number,
		public readonly reason?: string
	) {
		super(message);
		this.name = 'KubernetesError';
	}
}

export class ResourceNotFoundError extends KubernetesError {
	constructor(resourceType: string, namespace?: string, name?: string) {
		const identifier =
			namespace && name ? `${namespace}/${name}` : namespace || name || 'resources';
		super(`${resourceType} not found: ${identifier}`, 404, 'NotFound');
		this.name = 'ResourceNotFoundError';
	}
}

export class AuthenticationError extends KubernetesError {
	constructor(message = 'Failed to authenticate with Kubernetes API') {
		super(message, 401, 'Unauthorized');
		this.name = 'AuthenticationError';
	}
}

export class AuthorizationError extends KubernetesError {
	constructor(message = 'Insufficient permissions to access resource') {
		super(message, 403, 'Forbidden');
		this.name = 'AuthorizationError';
	}
}

export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

/**
 * Sanitize error messages to remove sensitive information like internal IP addresses or hostnames
 */
export function sanitizeK8sErrorMessage(message: string): string {
	if (!message) return 'An unknown error occurred';

	return (
		message
			// Redact URLs
			.replace(/https?:\/\/[^\s/]+/g, '[REDACTED URL]')
			// Redact IPv4 addresses
			.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[REDACTED IP]')
			// Redact possible sensitive tokens in messages
			.replace(/token=[a-zA-Z0-9._-]+/g, 'token=[REDACTED]')
			.replace(/password=[a-zA-Z0-9._-]+/g, 'password=[REDACTED]')
	);
}

/**
 * Handle API errors by logging them and returning a sanitized response to the client
 */
export function handleApiError(err: unknown, contextMessage = 'Kubernetes API error'): never {
	// Log the full error server-side
	console.error(`${contextMessage}:`, err);

	// If it's a known safe error, pass it through
	if (err instanceof KubernetesError) {
		throw error(err.code, {
			message: err.message,
			code: err.reason
		});
	}

	// If it's already a SvelteKit error (has status and body), re-throw it
	// We check for the structure because `err instanceof HttpError` is not easily available
	if (
		typeof err === 'object' &&
		err !== null &&
		'status' in err &&
		'body' in err &&
		typeof (err as { status: number }).status === 'number'
	) {
		throw err;
	}

	// For all other errors (including raw K8s errors), return a generic message
	throw error(500, {
		message: 'Kubernetes operation failed',
		code: 'InternalServerError'
	});
}

/**
 * Convert error to HTTP response
 */
export function errorToHttpResponse(error: unknown): {
	status: number;
	body: { error: string; code?: string };
} {
	if (error instanceof KubernetesError) {
		return {
			status: error.code,
			body: {
				error: error.message,
				code: error.reason
			}
		};
	}

	if (error instanceof ConfigurationError) {
		// Configuration errors might be safe? But safer to be generic if unsure.
		// Assuming ConfigurationError messages are safe (internal config issues, not user data).
		// But let's be safe.
		return {
			status: 500,
			body: {
				error: 'Configuration error',
				code: 'ConfigurationError'
			}
		};
	}

	// For all other errors, return a generic message to prevent leaking sensitive info
	return {
		status: 500,
		body: {
			error: 'An unexpected error occurred',
			code: 'InternalServerError'
		}
	};
}
