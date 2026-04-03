import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { listFluxResources, type ReqCache } from '$lib/server/kubernetes/client';
import { getAllResourceTypes } from '$lib/server/kubernetes/flux/resources';
import { getResourceStatus } from '$lib/utils/relationships';
import { checkClusterWideReadPermission } from '$lib/server/rbac.js';
import { logger } from '$lib/server/logger.js';

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
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Check permission
	const hasPermission = await checkClusterWideReadPermission(locals.user, locals.cluster);
	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	setHeaders({
		'Cache-Control': 'private, max-age=15, stale-while-revalidate=45'
	});
	const context = locals.cluster;
	const resourceTypes = getAllResourceTypes();
	const reqCache: ReqCache = new Map();

	const results = await Promise.all(
		resourceTypes.map(async (type) => {
			try {
				const data = await listFluxResources(type, context, reqCache);
				const items = data.items || [];

				let healthy = 0;
				let failed = 0;
				let suspended = 0;

				for (const item of items) {
					const status = getResourceStatus(item);
					if (status === 'ready') healthy++;
					else if (status === 'failed') failed++;
					else if (status === 'suspended') suspended++;
				}

				return {
					type,
					total: items.length,
					healthy,
					failed,
					suspended
				};
			} catch (err) {
				logger.warn({ type, err }, 'Failed to list Flux resources for overview');
				return { type, total: 0, healthy: 0, failed: 0, suspended: 0, error: true };
			}
		})
	);

	return json({
		timestamp: new Date().toISOString(),
		partialFailure: results.some((r) => r.error),
		results: results.filter((r) => !r.error)
	});
};
