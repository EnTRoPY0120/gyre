import { error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import {
	getAllResourcePlurals,
	getResourceDef,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { validateK8sNamespace, validateFluxResourceSpec } from '$lib/server/validation';

/** Zod schema shared by the runtime request validator and OpenAPI metadata. */
export const createFluxResourceBodySchema = z.looseObject({
	apiVersion: z.string().min(1),
	kind: z.string().min(1),
	metadata: z.looseObject({
		name: z.string().min(1),
		namespace: z.string().optional()
	}),
	spec: z.record(z.string(), z.unknown())
});

export type CreateFluxResourceBody = z.infer<typeof createFluxResourceBodySchema>;

export interface ValidatedCreateFluxResourceRequest {
	body: CreateFluxResourceBody;
	namespace: string;
	resolvedType: FluxResourceType;
}

function validateResourceIdentity(
	body: CreateFluxResourceBody,
	resolvedType: FluxResourceType
): void {
	const resourceDef = getResourceDef(resolvedType);
	if (!resourceDef) {
		throw error(400, { message: `Unknown Flux resource type: ${resolvedType}` });
	}

	if (body.kind !== resolvedType) {
		throw error(400, {
			message: `kind mismatch: body declares "${body.kind}" but endpoint handles "${resolvedType}"`
		});
	}

	if (body.apiVersion !== resourceDef.apiVersion) {
		throw error(400, {
			message: `apiVersion mismatch: body declares "${body.apiVersion}" but "${resolvedType}" requires "${resourceDef.apiVersion}"`
		});
	}

	const specError = validateFluxResourceSpec(resolvedType, body.spec);
	if (specError) {
		throw error(422, { message: specError });
	}
}

/** Validate and normalize the request before checking write permission. */
export function validateCreateFluxResourceRequest(
	rawBody: unknown,
	resourceType: string
): ValidatedCreateFluxResourceRequest {
	const parsed = createFluxResourceBodySchema.safeParse(rawBody);
	if (!parsed.success) {
		const message = parsed.error.issues
			.map((issue) => {
				const pathLabel = issue.path.length > 0 ? issue.path.join('.') : 'body';
				return `${pathLabel}: ${issue.message}`;
			})
			.join('; ');
		throw error(400, { message: `Invalid request body: ${message}` });
	}

	const body = parsed.data;
	const namespace = body.metadata.namespace ?? 'default';
	validateK8sNamespace(namespace);

	const resolvedType = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${getAllResourcePlurals().join(', ')}`
		});
	}

	validateResourceIdentity(body, resolvedType);
	body.metadata.namespace = namespace;

	return { body, namespace, resolvedType };
}
