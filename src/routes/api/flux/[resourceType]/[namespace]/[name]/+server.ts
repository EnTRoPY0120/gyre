import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFluxResource, getFluxResourceStatus } from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';

/**
 * GET /api/flux/{resourceType}/{namespace}/{name}
 * Get a specific resource
 *
 * Query params:
 * - status=true: Get resource status instead of full object
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { resourceType, namespace, name } = params;
	const getStatus = url.searchParams.get('status') === 'true';

	// Resolve resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		return error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	try {
		const resource = getStatus
			? await getFluxResourceStatus(resolvedType, namespace, name)
			: await getFluxResource(resolvedType, namespace, name);

		return json(resource);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
