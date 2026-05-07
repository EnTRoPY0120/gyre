import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import { getGyreInitializationStatus } from '$lib/server/request/initialization.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	GET: {
		summary: 'Application readiness check',
		description: 'Reports whether Gyre initialization has completed successfully.',
		tags: ['System'],
		responses: {
			200: {
				description: 'Application is ready',
				content: {
					'application/json': {
						schema: z.object({
							status: z.literal('ready')
						})
					}
				}
			},
			503: { description: 'Application initialization is incomplete or failed' }
		}
	}
};

export const GET: RequestHandler = async () => {
	const status = getGyreInitializationStatus();

	if (status.state === 'ready') {
		return json({ status: 'ready' });
	}

	if (status.state === 'failed') {
		return json({ status: 'failed', message: 'Gyre initialization failed' }, { status: 503 });
	}

	return json(
		{ status: 'initializing', message: 'Gyre initialization has not completed' },
		{ status: 503 }
	);
};
