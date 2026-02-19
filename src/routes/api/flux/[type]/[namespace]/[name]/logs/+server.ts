import { error, json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getControllerLogs } from '$lib/server/kubernetes/client';

export const _metadata = {
	GET: {
		summary: 'Get controller logs',
		description:
			'Retrieve recent log entries from the Flux controller responsible for reconciling this resource.',
		tags: ['Flux'],
		request: {
			params: z.object({
				type: z.string().openapi({ example: 'GitRepository' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			})
		},
		responses: {
			200: {
				description: 'Controller logs',
				content: {
					'application/json': {
						schema: z.object({ logs: z.string() })
					}
				}
			},
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { type, namespace, name } = params;

	// Check permission for read action
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		type as FluxResourceType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		const logs = await getControllerLogs(type as FluxResourceType, namespace, name, locals.cluster);
		return json({ logs });
	} catch (err) {
		handleApiError(err, `Error fetching logs for ${name}`);
	}
};
