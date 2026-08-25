import * as k8s from '@kubernetes/client-node';
import {
	AuthenticationError,
	AuthorizationError,
	ClusterUnavailableError,
	KubernetesError,
	ResourceNotFoundError
} from './errors.js';

const CONNECTION_ERROR_CODES = new Set([
	'ECONNREFUSED',
	'ETIMEDOUT',
	'ENOTFOUND',
	'EHOSTUNREACH',
	'ESOCKETTIMEDOUT',
	'ECONNRESET'
]);

type KubernetesErrorShape = Error & {
	code?: number | string;
	errno?: string;
	response?: { statusCode: number; body?: { message?: string } };
};

/** Detect the timeout shapes emitted by fetch and @kubernetes/client-node. */
export function isKubernetesAbortError(error: Error): boolean {
	return (
		error.name === 'AbortError' ||
		error instanceof k8s.AbortError ||
		(error as { type?: string }).type === 'aborted'
	);
}

/** Read the compatible network code and HTTP status fields from a Kubernetes error. */
export function getKubernetesErrorDetails(error: Error): {
	errorCode?: string;
	status?: number;
} {
	const details = error as KubernetesErrorShape;
	return {
		errorCode: details.code?.toString() ?? details.errno,
		status: typeof details.code === 'number' ? details.code : details.response?.statusCode
	};
}

export function isConnectionErrorCode(errorCode: string | undefined): boolean {
	return errorCode !== undefined && CONNECTION_ERROR_CODES.has(errorCode);
}

/** Convert a Kubernetes HTTP status into the public domain error used by callers. */
export function mapKubernetesStatus(status: number, operation: string): Error {
	const statusErrors: Record<number, () => Error> = {
		404: () => new ResourceNotFoundError(operation),
		401: () => new AuthenticationError(`Authentication failed: ${operation}`),
		403: () => new AuthorizationError(`Permission denied: ${operation}`),
		503: () => new ClusterUnavailableError(`Kubernetes cluster is unavailable (${status})`),
		504: () => new ClusterUnavailableError(`Kubernetes cluster is unavailable (${status})`)
	};

	return (
		statusErrors[status]?.() ??
		new KubernetesError(`Kubernetes API error (${status})`, status, 'ApiError')
	);
}
