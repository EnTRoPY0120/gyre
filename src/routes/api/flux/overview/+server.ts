import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client';
import { getAllResourceTypes } from '$lib/server/kubernetes/flux/resources';
import { getResourceStatus } from '$lib/utils/relationships';
import { checkPermission } from '$lib/server/rbac.js';

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	// Check authentication
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	// Check permission
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		undefined,
		undefined,
		locals.cluster
	);
	if (!hasPermission) {
		return error(403, { message: 'Permission denied' });
	}

	setHeaders({
		'Cache-Control': 'private, max-age=15, stale-while-revalidate=45'
	});
	const context = locals.cluster;
	const resourceTypes = getAllResourceTypes();

	const results = await Promise.all(
		resourceTypes.map(async (type) => {
			try {
				const data = await listFluxResources(type, context);
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
			} catch {
				return { type, total: 0, healthy: 0, failed: 0, suspended: 0, error: true };
			}
		})
	);

	return json({
		timestamp: new Date().toISOString(),
		results
	});
};
