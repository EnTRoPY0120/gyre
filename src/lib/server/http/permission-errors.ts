import { isHttpError } from '@sveltejs/kit';
import { AuthorizationError } from '../kubernetes/errors.js';
import { RbacError } from '../rbac.js';

function parseHttpStatus(value: unknown): number | null {
	if (typeof value === 'number') return value;
	if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
	return null;
}

export function isPermissionErrorLike(error: unknown): boolean {
	if (isHttpError(error)) {
		return error.status === 401 || error.status === 403;
	}
	if (error instanceof RbacError || error instanceof AuthorizationError) {
		return true;
	}

	if (typeof error !== 'object' || error === null) return false;

	const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
	const statusCode = parseHttpStatus(candidate.status) ?? parseHttpStatus(candidate.code);
	if (statusCode === 401 || statusCode === 403) return true;

	if (typeof candidate.code === 'string') {
		const normalizedCode = candidate.code.toLowerCase();
		if (normalizedCode === 'forbidden' || normalizedCode === 'unauthorized') return true;
	}

	return candidate.name === 'AuthorizationError' || candidate.name === 'RbacError';
}
