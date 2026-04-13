import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getFluxOverviewSummary } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';
import { setPrivateCacheHeaders } from '$lib/server/http/transport.js';

export const _metadata = {
	GET: {
		summary: 'Get FluxCD overview',
		description:
			'Retrieve status summaries for all FluxCD resource types. Requires explicit cluster-wide read permission.',
		tags: ['Flux'],
		responses: {
			200: {
				description: 'Overview status',
				content: {
					'application/json': {
						schema: z.object({
							timestamp: z.string(),
							partialFailure: z.boolean(),
							results: z.array(
								z.object({
									type: z.string(),
									total: z.number(),
									healthy: z.number(),
									failed: z.number(),
									suspended: z.number()
								})
							)
						})
					}
				}
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' }
		}
	}
};

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	await requireClusterWideRead(locals);
	setPrivateCacheHeaders(setHeaders, 'private, max-age=15, stale-while-revalidate=45');
	return json(await getFluxOverviewSummary({ locals }));
};
