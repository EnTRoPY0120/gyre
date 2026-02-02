import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reconcileResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';

export const POST: RequestHandler = async ({ params }) => {
	const { type, namespace, name } = params;

	try {
		await reconcileResource(type as FluxResourceType, namespace, name);
		return json({ success: true, message: `Reconciliation triggered for ${name}` });
	} catch (err) {
		console.error(`Error reconciling ${name}:`, err);
		return error(500, `Failed to trigger reconciliation: ${(err as Error).message}`);
	}
};
