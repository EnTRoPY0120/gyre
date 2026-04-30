import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import { k8sEventSchema } from '$lib/server/kubernetes/schemas';
import type { RequestHandler } from './$types';
import { getAllRecentEvents } from '$lib/server/kubernetes/events';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';

export const _metadata = {
	GET: {
		summary: 'List recent cluster events',
		description:
			'Retrieve recent Kubernetes events across all namespaces. Requires explicit cluster-wide read permission. Use the limit parameter to control how many events are returned.',
		tags: ['Flux'],
		request: {
			query: z.object({
				limit: z.coerce.number().int().min(1).max(1000).default(20).openapi({
					description: 'Maximum number of events to return (default: 20, max: 1000)',
					example: 50
				})
			})
		},
		responses: {
			200: {
				description: 'List of recent events',
				content: {
					'application/json': {
						schema: z.object({
							events: z.array(k8sEventSchema)
						})
					}
				}
			},
			400: { description: 'Bad request' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
		}
	}
};

const limitQuerySchema = _metadata.GET.request.query;

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireClusterWideRead(locals);

	const queryResult = limitQuerySchema.safeParse({
		limit: url.searchParams.get('limit') ?? undefined
	});
	if (!queryResult.success) {
		throw error(400, { message: 'Invalid limit parameter' });
	}
	const { limit } = queryResult.data;

	try {
		const events = await getAllRecentEvents(limit, locals.cluster);
		return json({ events });
	} catch (err) {
		handleApiError(err, 'Failed to fetch global events');
	}
};
