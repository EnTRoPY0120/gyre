import { error } from '@sveltejs/kit';

export interface RollbackRequestBody {
	dryRun: boolean;
	historyId?: string;
	revision?: string;
	target: string;
}

export async function parseRollbackRequestBody(request: Request): Promise<RollbackRequestBody> {
	let body: { dryRun?: unknown; historyId?: unknown; revision?: unknown };
	try {
		body = await request.json();
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(400, { message: 'Invalid JSON payload' });
	}

	if (body.revision !== undefined && typeof body.revision !== 'string') {
		throw error(400, { message: 'revision must be a string' });
	}
	if (body.historyId !== undefined && typeof body.historyId !== 'string') {
		throw error(400, { message: 'historyId must be a string' });
	}
	if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') {
		throw error(400, { message: 'dryRun must be a boolean' });
	}

	const revision = body.revision;
	const historyId = body.historyId;
	const dryRun = body.dryRun === true;

	if (revision && revision.length > 500) {
		throw error(400, { message: 'revision exceeds maximum length of 500 characters' });
	}
	if (historyId && historyId.length > 500) {
		throw error(400, { message: 'historyId exceeds maximum length of 500 characters' });
	}
	if (!revision && !historyId) {
		throw error(400, { message: 'Either revision or historyId is required for rollback' });
	}

	return {
		dryRun,
		historyId,
		revision,
		target: historyId || revision || ''
	};
}
