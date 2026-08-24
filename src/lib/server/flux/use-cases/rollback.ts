import { error } from '@sveltejs/kit';
import { validateRollbackRequestBody, type RollbackRequestBody } from './rollback-validation.js';

export type { RollbackRequestBody } from './rollback-validation.js';

export async function parseRollbackRequestBody(request: Request): Promise<RollbackRequestBody> {
	let body: unknown;
	try {
		body = await request.json();
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(400, { message: 'Invalid JSON payload' });
	}

	return validateRollbackRequestBody(body);
}
