import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getFluxResource,
	getFluxResourceStatus,
	updateFluxResource
} from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { checkPermission } from '$lib/server/rbac.js';
import type { K8sResource } from '$lib/types/kubernetes';
import yaml from 'js-yaml';

/**
 * GET /api/flux/{resourceType}/{namespace}/{name}
 * Get a specific resource
 *
 * Query params:
 * - status=true: Get resource status instead of full object
 */
export const GET: RequestHandler = async ({ params, url, locals, request, setHeaders }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Check cluster context
	if (!locals.cluster) {
		throw error(400, { message: 'Cluster context required' });
	}

	const { resourceType, namespace, name } = params;
	const getStatus = url.searchParams.get('status') === 'true';

	// Resolve resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Check permission for specific namespace
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		const resource = getStatus
			? await getFluxResourceStatus(resolvedType, namespace, name, locals.cluster)
			: await getFluxResource(resolvedType, namespace, name, locals.cluster);

		// Generate ETag from resourceVersion if available
		const resourceVersion = resource.metadata?.resourceVersion;
		if (resourceVersion) {
			const etag = `W/"${resourceVersion}"`;

			// Check If-None-Match header
			const ifNoneMatch = request.headers.get('if-none-match');
			if (ifNoneMatch === etag) {
				return new Response(null, { status: 304 });
			}

			setHeaders({
				ETag: etag,
				'Cache-Control': 'private, max-age=10, stale-while-revalidate=30'
			});
		}

		return json(resource);
	} catch (err) {
		throw handleApiError(err, `Error fetching ${resolvedType} ${namespace}/${name}`);
	}
};

/**
 * PUT /api/flux/{resourceType}/{namespace}/{name}
 * Update a specific resource
 *
 * Body: { yaml: string } - The updated resource YAML
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Check cluster context
	if (!locals.cluster) {
		throw error(400, { message: 'Cluster context required' });
	}

	const { resourceType, namespace, name } = params;

	// Resolve resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Check permission for specific namespace
	const hasPermission = await checkPermission(
		locals.user,
		'write',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	// Parse request body
	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	if (!body.yaml || typeof body.yaml !== 'string') {
		throw error(400, { message: 'Missing or invalid yaml field in request body' });
	}

	// Parse YAML to object
	let resource: K8sResource;
	try {
		resource = yaml.load(body.yaml) as K8sResource;
	} catch (err) {
		throw error(400, {
			message: `Invalid YAML: ${err instanceof Error ? err.message : 'Unable to parse'}`
		});
	}

	// Validate resource structure
	if (!resource || typeof resource !== 'object') {
		throw error(400, { message: 'Invalid resource: must be a valid Kubernetes object' });
	}

	if (!resource.apiVersion || !resource.kind || !resource.metadata) {
		throw error(400, {
			message: 'Invalid resource: missing required fields (apiVersion, kind, metadata)'
		});
	}

	// Validate name and namespace match
	if (resource.metadata.name !== name) {
		throw error(400, {
			message: `Resource name mismatch: expected "${name}", got "${resource.metadata.name}"`
		});
	}

	if (resource.metadata.namespace && resource.metadata.namespace !== namespace) {
		throw error(400, {
			message: `Namespace mismatch: expected "${namespace}", got "${resource.metadata.namespace}"`
		});
	}

	try {
		// Update the resource
		const updated = await updateFluxResource(
			resolvedType,
			namespace,
			name,
			resource,
			locals.cluster
		);

		return json(updated);
	} catch (err) {
		throw handleApiError(err, `Error updating ${resolvedType} ${namespace}/${name}`);
	}
};
