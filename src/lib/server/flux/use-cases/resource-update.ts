import { error } from '@sveltejs/kit';
import { getResourceDef, type FluxResourceType } from '$lib/server/kubernetes/flux/resources.js';
import { validateFluxResourceSpec } from '$lib/server/validation';
import type { K8sResource } from '$lib/types/kubernetes';
import yaml from 'js-yaml';

export interface ValidateFluxResourceUpdateParams {
	name: string;
	namespace: string;
	requestBody: unknown;
	resourceType: FluxResourceType;
}

export async function parseFluxResourceUpdateBody(request: Request): Promise<{ yaml: string }> {
	let body: { yaml?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	if (!body.yaml || typeof body.yaml !== 'string') {
		throw error(400, { message: 'Missing or invalid yaml field in request body' });
	}

	return { yaml: body.yaml };
}

export function validateFluxResourceUpdateManifest({
	name,
	namespace,
	requestBody,
	resourceType
}: ValidateFluxResourceUpdateParams): K8sResource {
	let resource: K8sResource;
	try {
		resource = yaml.load(requestBody as string, { schema: yaml.JSON_SCHEMA }) as K8sResource;
	} catch (err) {
		throw error(400, {
			message: `Invalid YAML: ${err instanceof Error ? err.message : 'Unable to parse'}`
		});
	}

	if (!resource || typeof resource !== 'object') {
		throw error(400, { message: 'Invalid resource: must be a valid Kubernetes object' });
	}

	if (!resource.apiVersion || !resource.kind || !resource.metadata) {
		throw error(400, {
			message: 'Invalid resource: missing required fields (apiVersion, kind, metadata)'
		});
	}

	if (resource.kind !== resourceType) {
		throw error(400, {
			message: `kind mismatch: expected "${resourceType}", got "${resource.kind}"`
		});
	}

	const resourceDef = getResourceDef(resourceType)!;
	if (resource.apiVersion !== resourceDef.apiVersion) {
		throw error(400, {
			message: `apiVersion mismatch: expected "${resourceDef.apiVersion}", got "${resource.apiVersion}"`
		});
	}

	const specError = validateFluxResourceSpec(
		resourceType,
		(resource.spec ?? {}) as Record<string, unknown>
	);
	if (specError) {
		throw error(422, { message: specError });
	}

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

	return resource;
}
