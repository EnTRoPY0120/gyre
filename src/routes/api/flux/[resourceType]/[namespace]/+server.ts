import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResourcesInNamespace } from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';

/**
 * GET /api/flux/{resourceType}/{namespace}
 * List all resources of a specific type in a namespace
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { resourceType, namespace } = params;

	// Resolve resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		return error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	try {
		const resources = await listFluxResourcesInNamespace(resolvedType, namespace, locals.cluster);
		return json(resources);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
