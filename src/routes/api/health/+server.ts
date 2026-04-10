import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';

export const _metadata = {
	GET: {
		summary: 'Application health check',
		description: 'Lightweight process health endpoint with no Kubernetes dependency.',
		tags: ['System'],
		responses: {
			200: {
				description: 'Application is healthy',
				content: {
					'application/json': {
						schema: z.object({
							status: z.literal('ok')
						})
					}
				}
			}
		}
	}
};

export const GET: RequestHandler = async () => {
	return json({ status: 'ok' });
};
