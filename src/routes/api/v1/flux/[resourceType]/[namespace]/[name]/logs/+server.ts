import { z } from '$lib/server/openapi';
import { getFluxResourceLogs } from '$lib/server/flux/use-cases/resource-actions.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	GET: {
		summary: 'Get controller logs',
		description:
			'Retrieve recent log entries from the Flux controller responsible for reconciling this resource.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'gitrepositories' }),
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
			400: { description: 'Invalid resource type' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};

export const GET: RequestHandler = ({ params, locals }) => getFluxResourceLogs({ params, locals });
