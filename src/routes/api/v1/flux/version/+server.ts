import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getFluxInstalledVersion } from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';

export const _metadata = {
	GET: {
		summary: 'Get Flux version',
		description:
			'Retrieve the Flux version installed in the cluster by inspecting deployment labels in the flux-system namespace. Requires explicit cluster-wide read permission.',
		tags: ['Flux'],
		responses: {
			200: {
				description: 'Flux version',
				content: {
					'application/json': {
						schema: z.object({
							version: z.string().openapi({ example: 'v2.3.0' })
						})
					}
				}
			},
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};

/**
 * GET /api/flux/version
 * Fetches the Flux version from the cluster by checking the 'app.kubernetes.io/version' label
 * on the flux-system deployments or namespace.
 */
export const GET: RequestHandler = async ({ locals }) => {
	await requireClusterWideRead(locals);
	return json(await getFluxInstalledVersion({ locals }));
};
