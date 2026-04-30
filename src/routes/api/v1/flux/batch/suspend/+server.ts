import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { MAX_BATCH_SIZE } from '$lib/server/config/limits';
import { batchResourceSchema, batchResultSchema } from '$lib/server/kubernetes/flux/batch-schemas';
import { runBatchFluxOperation } from '$lib/server/flux/use-cases/batch-operation.js';

export const _metadata = {
	POST: {
		summary: 'Batch suspend resources',
		description: `Suspend reconciliation for multiple FluxCD resources (up to ${MAX_BATCH_SIZE}) in a single request. Per-resource permission checks are applied.`,
		tags: ['Flux'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							resources: z
								.array(batchResourceSchema)
								.max(MAX_BATCH_SIZE)
								.openapi({ description: `List of resources to suspend (max ${MAX_BATCH_SIZE})` })
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Batch operation results',
				content: {
					'application/json': {
						schema: z.object({
							results: z.array(batchResultSchema),
							summary: z.object({
								total: z.number(),
								successful: z.number(),
								failed: z.number()
							})
						})
					}
				}
			},
			400: { description: 'Invalid request body or missing cluster context' },
			401: { description: 'Authentication required' }
		}
	}
};

export const POST: RequestHandler = ({ request, locals, getClientAddress, setHeaders }) =>
	runBatchFluxOperation({
		operation: 'suspend',
		request,
		locals,
		getClientAddress,
		setHeaders
	});
