import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';
import {
	AuthenticationError,
	AuthorizationError,
	ClusterUnavailableError,
	KubernetesError,
	KubernetesTimeoutError,
	ResourceNotFoundError
} from './errors.js';
import { DEFAULT_TIMEOUT_MS } from './timeouts.js';

/**
 * Handle Kubernetes API errors
 */
export function handleK8sError(
	error: unknown,
	operation: string,
	timeoutMs = DEFAULT_TIMEOUT_MS
): Error {
	// Log the full error server-side for debugging
	logger.error(error, `Kubernetes API error during ${operation}`);

	if (error instanceof Error) {
		// Detect AbortController-triggered timeouts (node-fetch surfaces these as
		// AbortError or as a generic Error with name 'AbortError').
		if (
			error.name === 'AbortError' ||
			error instanceof k8s.AbortError ||
			(error as { type?: string }).type === 'aborted'
		) {
			return new KubernetesTimeoutError(operation, timeoutMs);
		}

		// @kubernetes/client-node v1 throws ApiException with a `code` property directly
		const apiException = error as Error & { code?: number | string };
		// Older versions used `response.statusCode`
		const k8sError = error as Error & {
			response?: { statusCode: number; body?: { message?: string } };
			errno?: string;
		};

		// Check for connection-related errors
		const connectionErrors = [
			'ECONNREFUSED',
			'ETIMEDOUT',
			'ENOTFOUND',
			'EHOSTUNREACH',
			'ESOCKETTIMEDOUT',
			'ECONNRESET'
		];

		const errorCode = apiException.code?.toString() ?? k8sError.errno;
		if (errorCode && connectionErrors.includes(errorCode)) {
			return new ClusterUnavailableError(`Kubernetes cluster is unavailable: ${errorCode}`);
		}

		const status =
			typeof apiException.code === 'number' ? apiException.code : k8sError.response?.statusCode;

		if (status !== undefined) {
			switch (status) {
				case 404:
					return new ResourceNotFoundError(operation);
				case 401:
					return new AuthenticationError(`Authentication failed: ${operation}`);
				case 403:
					return new AuthorizationError(`Permission denied: ${operation}`);
				case 503:
				case 504:
					return new ClusterUnavailableError(`Kubernetes cluster is unavailable (${status})`);
				default:
					return new KubernetesError(`Kubernetes API error (${status})`, status, 'ApiError');
			}
		}
		return new KubernetesError(`Failed to ${operation}: Internal Error`, 500, 'InternalError');
	}
	return new KubernetesError(`Failed to ${operation}: Unknown error`, 500, 'UnknownError');
}
