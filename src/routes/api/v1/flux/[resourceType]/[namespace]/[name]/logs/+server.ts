import { z } from '$lib/server/openapi';
import { getFluxResourceLogs } from '$lib/server/flux/use-cases/resource-actions.js';
import { createFluxResourceReadMetadata } from '$lib/server/openapi/flux-route-metadata.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	GET: createFluxResourceReadMetadata({
		summary: 'Get controller logs',
		description:
			'Retrieve recent log entries from the Flux controller responsible for reconciling this resource.',
		responseDescription: 'Controller logs',
		responseSchema: z.object({ logs: z.string() })
	})
};

export const GET: RequestHandler = ({ params, locals }) => getFluxResourceLogs({ params, locals });
