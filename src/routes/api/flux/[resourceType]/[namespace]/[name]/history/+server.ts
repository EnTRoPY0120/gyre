import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getReconciliationHistory } from '$lib/server/kubernetes/flux/reconciliation-tracker';

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
				limit: z
					.string()
					.optional()
					.openapi({
						description: 'Max entries to return (default: 100, max: 1000)',
						example: '50'
					}),
				status: z
					.string()
					.optional()
					.openapi({ description: 'Filter by status: success, failure, or unknown' }),
				since: z
					.string()
					.optional()
					.openapi({
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
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	const resolvedType = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		throw error(400, { message: `Invalid resource type: ${resourceType}` });
	}

	// Check permission
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

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
		const timeline = await getReconciliationHistory(resolvedType, namespace, name, locals.cluster, {
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
