export interface PrivilegedDeleteOptions {
	requirePermission: () => Promise<void>;
	deleteResource: () => Promise<void>;
	logFailure: (error: unknown) => Promise<void>;
	logSuccess: () => Promise<void>;
	mapError: (error: unknown) => unknown;
}

export function isPermissionDeniedError(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'status' in error &&
		(error as { status: unknown }).status === 403
	);
}

export async function executePrivilegedDelete({
	requirePermission,
	deleteResource,
	logFailure,
	logSuccess,
	mapError
}: PrivilegedDeleteOptions): Promise<void> {
	try {
		await requirePermission();
	} catch (error) {
		await logFailure(isPermissionDeniedError(error) ? 'Permission denied' : error);
		throw error;
	}

	try {
		await deleteResource();
		await logSuccess();
	} catch (error) {
		await logFailure(error);
		throw mapError(error);
	}
}
