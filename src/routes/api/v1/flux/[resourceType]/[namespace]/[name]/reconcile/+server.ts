import { runFluxResourceAction } from '$lib/server/flux/use-cases/resource-actions.js';
import { createFluxResourceActionMetadata } from '$lib/server/openapi/flux-route-metadata.js';
import type { RequestHandler } from './$types';

export const _metadata = {
	POST: createFluxResourceActionMetadata({
		summary: 'Trigger reconciliation',
		description:
			'Trigger an immediate reconciliation for a specific FluxCD resource by annotating it with the reconcile request annotation.',
		successDescription: 'Reconciliation triggered successfully'
	})
};

export const POST: RequestHandler = ({ params, locals, getClientAddress }) =>
	runFluxResourceAction({ action: 'reconcile', params, locals, getClientAddress });
