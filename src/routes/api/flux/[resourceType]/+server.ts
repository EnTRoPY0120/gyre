import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client.js';
import {
	getAllResourceTypes,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';

/**
 * GET /api/flux/{resourceType}
 * List all resources of a specific type across all namespaces
 */
export const GET: RequestHandler = async ({ params }) => {
	const { resourceType } = params;

	// Validate resource type
	const validTypes = getAllResourceTypes();
	if (!validTypes.includes(resourceType as FluxResourceType)) {
		return error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validTypes.join(', ')}`
		});
	}

	try {
		const resources = await listFluxResources(resourceType as FluxResourceType);
		return json(resources);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
