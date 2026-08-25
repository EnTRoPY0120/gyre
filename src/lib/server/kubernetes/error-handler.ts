import { logger } from '../logger.js';
import { ClusterUnavailableError, KubernetesError, KubernetesTimeoutError } from './errors.js';
import {
	getKubernetesErrorDetails,
	isConnectionErrorCode,
	isKubernetesAbortError,
	mapKubernetesStatus
} from './error-classification.js';
import { DEFAULT_TIMEOUT_MS } from './timeouts.js';

function classifyKubernetesError(error: Error, operation: string, timeoutMs: number): Error {
	// Detect AbortController-triggered timeouts (node-fetch surfaces these as
	// AbortError or as a generic Error with name 'AbortError').
	if (isKubernetesAbortError(error)) {
		return new KubernetesTimeoutError(operation, timeoutMs);
	}

	const { errorCode, status } = getKubernetesErrorDetails(error);
	if (isConnectionErrorCode(errorCode)) {
		return new ClusterUnavailableError(`Kubernetes cluster is unavailable: ${errorCode}`);
	}

	if (status !== undefined) {
		return mapKubernetesStatus(status, operation);
	}

	return new KubernetesError(`Failed to ${operation}: Internal Error`, 500, 'InternalError');
}

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
		return classifyKubernetesError(error, operation, timeoutMs);
	}
	return new KubernetesError(`Failed to ${operation}: Unknown error`, 500, 'UnknownError');
}
