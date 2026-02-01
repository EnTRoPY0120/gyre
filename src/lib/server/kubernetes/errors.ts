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
		return {
			status: 500,
			body: {
				error: error.message,
				code: 'ConfigurationError'
			}
		};
	}

	if (error instanceof Error) {
		return {
			status: 500,
			body: {
				error: error.message
			}
		};
	}

	return {
		status: 500,
		body: {
			error: 'An unknown error occurred'
		}
	};
}
