import { MAX_BATCH_SIZE } from '$lib/server/config/limits';
import { batchResourceSchema, batchResultSchema } from '$lib/server/kubernetes/flux/batch-schemas';
import { z } from '$lib/server/openapi';

type BatchRouteMetadataConfig = {
	summary: string;
	description: string;
	resourceListDescription: string;
};

export function createBatchRouteMetadata({
	summary,
	description,
	resourceListDescription
}: BatchRouteMetadataConfig) {
	return {
		POST: {
			summary,
			description,
			tags: ['Flux'],
			request: {
				body: {
					content: {
						'application/json': {
							schema: z.object({
								resources: z
									.array(batchResourceSchema)
									.max(MAX_BATCH_SIZE)
									.openapi({ description: resourceListDescription })
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
}
