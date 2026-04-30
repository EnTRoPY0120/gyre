import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getReconciliationHistory } from '$lib/server/kubernetes/flux/reconciliation-tracker';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { requireFluxResourceRead } from '$lib/server/http/guards.js';

export const _metadata = {
	GET: {
		summary: 'Get reconciliation history',
		description:
			'Retrieve the reconciliation history timeline for a specific FluxCD resource. Supports filtering by status and date.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'kustomizations' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-app' })
			}),
			query: z.object({
				limit: z.string().optional().openapi({
					description: 'Max entries to return (default: 100, clamped to 1–1000)',
					example: '50'
				}),
				status: z
					.enum(['success', 'failure', 'unknown'])
					.optional()
					.openapi({ description: 'Filter by reconciliation status' }),
				since: z.string().optional().openapi({
					description: 'ISO8601 date to filter entries after',
					example: '2024-01-01T00:00:00Z'
				})
			})
		},
		responses: {
			200: {
				description: 'Reconciliation history timeline',
				content: {
					'application/json': {
						schema: z.object({
							timeline: z.array(z.any()),
							total: z.number()
						})
					}
				}
			},
			400: { description: 'Invalid resource type' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { resourceType, namespace, name, clusterId } = await requireFluxResourceRead(
		locals,
		params
	);

	// Parse and validate query parameters
	const limitParam = url.searchParams.get('limit');
	const parsedLimit = limitParam ? parseInt(limitParam, 10) : 100;
	const limit = Number.isNaN(parsedLimit) ? 100 : Math.min(Math.max(parsedLimit, 1), 1000);

	const statusParam = url.searchParams.get('status');
	const allowedStatuses = ['success', 'failure', 'unknown'];
	const statusFilter =
		statusParam && allowedStatuses.includes(statusParam)
			? (statusParam as 'success' | 'failure' | 'unknown')
			: null;

	const sinceParam = url.searchParams.get('since');
	let since: Date | undefined;
	if (sinceParam) {
		const sinceDate = new Date(sinceParam);
		since = Number.isNaN(sinceDate.getTime()) ? undefined : sinceDate;
	}

	try {
		const timeline = await getReconciliationHistory(resourceType, namespace, name, clusterId, {
			limit,
			status: statusFilter || undefined,
			since
		});

		return json({
			timeline,
			total: timeline.length
		});
	} catch (err: unknown) {
		handleApiError(err, `Failed to fetch history for ${name}`);
	}
};
