const ALLOWED_CODES = new Set(['INVALID_INPUT', 'NOT_AUTHORIZED', 'NOT_FOUND', 'UNKNOWN']);

export function normalizeError(error: unknown): { code: string; status?: number } {
	const rawCode =
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof (error as { code: unknown }).code === 'string'
			? (error as { code: string }).code
			: 'UNKNOWN';

	const status =
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status: unknown }).status === 'number'
			? (error as { status: number }).status
			: undefined;

	return {
		code: ALLOWED_CODES.has(rawCode) ? rawCode : 'UNKNOWN',
		status
	};
}
