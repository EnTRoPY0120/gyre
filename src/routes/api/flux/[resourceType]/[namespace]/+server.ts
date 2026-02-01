import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResourcesInNamespace } from '$lib/server/kubernetes/client.js';
import {
	getAllResourceTypes,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';

/**
 * GET /api/flux/{resourceType}/{namespace}
 * List all resources of a specific type in a namespace
 */
export const GET: RequestHandler = async ({ params }) => {
	const { resourceType, namespace } = params;

	// Validate resource type
	const validTypes = getAllResourceTypes();
	if (!validTypes.includes(resourceType as FluxResourceType)) {
		return error(400, {
			message: `Invalid resource type: ${resourceType}`
		});
	}

	try {
		const resources = await listFluxResourcesInNamespace(
			resourceType as FluxResourceType,
			namespace
		);
		return json(resources);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
