import { runFluxResourceAction } from '$lib/server/flux/use-cases/resource-actions.js';
import { createFluxResourceActionMetadata } from '$lib/server/openapi/flux-route-metadata.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	POST: createFluxResourceActionMetadata({
		summary: 'Resume resource',
		description: 'Resume reconciliation for a suspended FluxCD resource.',
		successDescription: 'Resource resumed successfully',
		includeInternalServerError: true
	})
};

export const POST: RequestHandler = ({ params, locals, getClientAddress }) =>
	runFluxResourceAction({ action: 'resume', params, locals, getClientAddress });
