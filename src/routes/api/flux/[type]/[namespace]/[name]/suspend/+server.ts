import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleSuspendResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { type, namespace, name } = params;

	try {
		await toggleSuspendResource(type as FluxResourceType, namespace, name, true, locals.cluster);
		return json({ success: true, message: `Suspended ${name}` });
	} catch (err) {
		console.error(`Error suspending ${name}:`, err);
		return error(500, `Failed to suspend resource: ${(err as Error).message}`);
	}
};
