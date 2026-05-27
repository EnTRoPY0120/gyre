import type { RequestHandler } from './$types';
import { MAX_BATCH_SIZE } from '$lib/server/config/limits';
import { createBatchRouteMetadata } from '$lib/server/flux/batch-route-metadata';
import { runBatchFluxOperation } from '$lib/server/flux/use-cases/batch-operation.js';

export const _metadata = createBatchRouteMetadata({
	summary: 'Batch delete resources',
	description: `Delete multiple FluxCD resources (up to ${MAX_BATCH_SIZE}) in a single request. This is a destructive operation. Per-resource permission checks are applied.`,
	resourceListDescription: `List of resources to delete (max ${MAX_BATCH_SIZE})`
});

export const POST: RequestHandler = ({ request, locals, getClientAddress, setHeaders }) =>
	runBatchFluxOperation({
		operation: 'delete',
		request,
		locals,
		getClientAddress,
		setHeaders
	});
