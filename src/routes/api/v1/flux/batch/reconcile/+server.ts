import type { RequestHandler } from './$types';
import { MAX_BATCH_SIZE } from '$lib/server/config/limits';
import { createBatchRouteMetadata } from '$lib/server/flux/batch-route-metadata';
import { runBatchFluxOperation } from '$lib/server/flux/use-cases/batch-operation.js';

export const _metadata = createBatchRouteMetadata({
	summary: 'Batch reconcile resources',
	description: `Trigger immediate reconciliation for multiple FluxCD resources (up to ${MAX_BATCH_SIZE}) in a single request. Per-resource permission checks are applied.`,
	resourceListDescription: `List of resources to reconcile (max ${MAX_BATCH_SIZE})`
});

export const POST: RequestHandler = ({ request, locals, getClientAddress, setHeaders }) =>
	runBatchFluxOperation({
		operation: 'reconcile',
		request,
		locals,
		getClientAddress,
		setHeaders
	});
