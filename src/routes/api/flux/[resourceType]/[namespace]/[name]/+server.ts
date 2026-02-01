import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFluxResource, getFluxResourceStatus } from '$lib/server/kubernetes/client.js';
import {
	getAllResourceTypes,
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

	// Validate resource type
	const validTypes = getAllResourceTypes();
	if (!validTypes.includes(resourceType as FluxResourceType)) {
		return error(400, {
			message: `Invalid resource type: ${resourceType}`
		});
	}

	try {
		const resource = getStatus
			? await getFluxResourceStatus(resourceType as FluxResourceType, namespace, name)
			: await getFluxResource(resourceType as FluxResourceType, namespace, name);

		return json(resource);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
