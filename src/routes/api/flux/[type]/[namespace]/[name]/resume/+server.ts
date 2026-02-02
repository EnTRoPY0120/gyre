import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toggleSuspendResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { type, namespace, name } = params;

	try {
		await toggleSuspendResource(type as FluxResourceType, namespace, name, false, locals.cluster);
		return json({ success: true, message: `Resumed ${name}` });
	} catch (err) {
		console.error(`Error resuming ${name}:`, err);
		return error(500, `Failed to resume resource: ${(err as Error).message}`);
	}
};
