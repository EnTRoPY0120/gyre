import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client';
import { getAllResourceTypes } from '$lib/server/kubernetes/flux/resources';
import { getResourceStatus } from '$lib/utils/relationships';

export const GET: RequestHandler = async ({ cookies, setHeaders }) => {
	setHeaders({
		'Cache-Control': 'private, max-age=15, stale-while-revalidate=45'
	});
	const context = cookies.get('gyre_cluster');
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
