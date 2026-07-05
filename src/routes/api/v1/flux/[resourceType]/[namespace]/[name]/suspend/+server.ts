import { runFluxResourceAction } from '$lib/server/flux/use-cases/resource-actions.js';
import { createFluxResourceActionMetadata } from '$lib/server/openapi/flux-route-metadata.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	POST: createFluxResourceActionMetadata({
		summary: 'Suspend resource',
		description:
			'Suspend reconciliation for a specific FluxCD resource. The resource will not be reconciled until resumed.',
		successDescription: 'Resource suspended successfully',
		includeInternalServerError: true
	})
};

export const POST: RequestHandler = ({ params, locals, getClientAddress }) =>
	runFluxResourceAction({ action: 'suspend', params, locals, getClientAddress });
