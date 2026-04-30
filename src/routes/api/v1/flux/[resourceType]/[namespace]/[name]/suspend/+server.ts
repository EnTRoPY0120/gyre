import { z } from '$lib/server/openapi';
import { runFluxResourceAction } from '$lib/server/flux/use-cases/resource-actions.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	POST: {
		summary: 'Suspend resource',
		description:
			'Suspend reconciliation for a specific FluxCD resource. The resource will not be reconciled until resumed.',
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
				description: 'Resource suspended successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean(), message: z.string() })
					}
				}
			},
			400: { description: 'Invalid namespace or resource name' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
		}
	}
};

export const POST: RequestHandler = ({ params, locals, getClientAddress }) =>
	runFluxResourceAction({ action: 'suspend', params, locals, getClientAddress });
