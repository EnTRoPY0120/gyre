import { sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';

export function sanitizeRollbackError(error: unknown): string {
	return sanitizeK8sErrorMessage(error instanceof Error ? error.message : String(error));
}
