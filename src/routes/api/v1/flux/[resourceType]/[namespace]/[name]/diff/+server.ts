import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { requireAuthenticatedUser, requireScopedPermission } from '$lib/server/http/guards.js';
import { classifyDiffError } from '$lib/server/kubernetes/flux/diff-errors';
import { validateK8sNamespace, validateK8sName } from '$lib/server/validation';
import {
	getDiffCacheControl,
	runFluxResourceDiff
} from '$lib/server/flux/use-cases/resource-diff.js';

export const _metadata = {
	GET: {
		summary: 'Get resource drift diff',
		description:
			'Compare the desired state (from source artifact) against the live cluster state for a Kustomization. Only available when Gyre is deployed in-cluster.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'kustomizations' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-app' })
			}),
			query: z.object({
				force: z.string().optional().openapi({
					description:
						"Set to 'true' to set `Cache-Control: no-store` on the response, preventing client-side caching."
				})
			})
		},
		responses: {
			200: {
				description: 'Drift diff results',
				content: {
					'application/json': {
						schema: z.object({
							diffs: z.array(
								z.object({
									kind: z.string(),
									name: z.string(),
									namespace: z.string(),
									desired: z.string(),
									live: z.string().nullable(),
									error: z.string().optional()
								})
							),
							timestamp: z.number(),
							revision: z.string().nullable().optional()
						})
					}
				}
			},
			400: {
				description: 'Unsupported resource type or missing sourceRef',
				content: {
					'application/json': { schema: errorSchema }
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': { schema: errorSchema }
				}
			},
			403: {
				description: 'Permission denied',
				content: {
					'application/json': { schema: errorSchema }
				}
			},
			500: {
				description: 'Internal server error',
				content: {
					'application/json': { schema: errorSchema }
				}
			},
			503: {
				description: 'Drift detection only available in-cluster',
				content: {
					'application/json': { schema: errorSchema }
				}
			}
		}
	}
};

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { resourceType: pluralType, namespace, name } = params;
	const clusterId = locals.cluster;

	validateK8sNamespace(namespace);
	validateK8sName(name);
	const forceRefresh = url.searchParams.get('force') === 'true';

	// Check if running in-cluster (required for drift detection)
	const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
	if (!isInCluster) {
		throw error(503, {
			message:
				'Drift detection is only available when Gyre is deployed in a Kubernetes cluster. ' +
				'This feature requires in-cluster access to the source-controller and is not supported in local development mode.',
			code: 'ServiceUnavailable'
		});
	}

	const resourceType = getResourceTypeByPlural(pluralType);

	// Only kustomizations support diffing for now
	if (resourceType !== 'Kustomization') {
		throw error(400, {
			message: 'Diffing is only supported for Kustomizations',
			code: 'BadRequest'
		});
	}

	requireAuthenticatedUser(locals);
	await requireScopedPermission(locals, 'read', 'Kustomization', namespace);

	// Allow overriding the Flux system namespace via environment variable.
	// Defaults to flux-system but can be changed for non-standard installations.
	const fluxNamespace = process.env.FLUX_NAMESPACE || 'flux-system';

	try {
		const result = await runFluxResourceDiff({
			clusterId,
			fluxNamespace,
			name,
			namespace,
			resourceType
		});

		return json(result, {
			headers: { 'Cache-Control': getDiffCacheControl(forceRefresh) }
		});
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}

		logger.error(err, 'Diff error:');
		const { status, message: clientMessage } = classifyDiffError(err);
		const code =
			status === 503 ? 'ServiceUnavailable' : status === 400 ? 'BadRequest' : 'InternalServerError';
		throw error(status, { message: clientMessage, code });
	}
};
