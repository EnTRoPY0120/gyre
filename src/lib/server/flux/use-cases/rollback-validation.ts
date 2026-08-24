import { error } from '@sveltejs/kit';

export interface RollbackRequestBody {
	dryRun: boolean;
	historyId?: string;
	revision?: string;
	target: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(
	body: Record<string, unknown>,
	field: 'historyId' | 'revision'
): string | undefined {
	const value = body[field];
	if (value !== undefined && typeof value !== 'string') {
		throw error(400, { message: `${field} must be a string` });
	}
	return value as string | undefined;
}

function validateTargetLength(value: string | undefined, field: 'historyId' | 'revision'): void {
	if (value && value.length > 500) {
		throw error(400, { message: `${field} exceeds maximum length of 500 characters` });
	}
}

/** Validate the decoded rollback body and select the history target. */
export function validateRollbackRequestBody(body: unknown): RollbackRequestBody {
	if (!isRecord(body)) throw error(400, { message: 'Invalid JSON payload' });

	const revision = readOptionalString(body, 'revision');
	const historyId = readOptionalString(body, 'historyId');
	if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') {
		throw error(400, { message: 'dryRun must be a boolean' });
	}

	validateTargetLength(revision, 'revision');
	validateTargetLength(historyId, 'historyId');
	if (!revision && !historyId) {
		throw error(400, { message: 'Either revision or historyId is required for rollback' });
	}

	return {
		dryRun: body.dryRun === true,
		historyId,
		revision,
		target: historyId || revision || ''
	};
}
