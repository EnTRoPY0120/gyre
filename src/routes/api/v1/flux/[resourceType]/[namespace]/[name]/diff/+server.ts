import { json } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	getDiffCacheControl,
	runFluxResourceDiff
} from '$lib/server/flux/use-cases/resource-diff.js';
import { authorizeDiffRoute, handleDiffRouteError, validateDiffRoute } from './route-helpers.js';

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
	const context = validateDiffRoute({
		...params,
		clusterId: locals.cluster,
		forceRefresh: url.searchParams.get('force') === 'true'
	});
	await authorizeDiffRoute(locals, context.namespace);

	try {
		const result = await runFluxResourceDiff({
			clusterId: context.clusterId,
			fluxNamespace: context.fluxNamespace,
			name: context.name,
			namespace: context.namespace,
			resourceType: context.resourceType
		});

		return json(result, {
			headers: { 'Cache-Control': getDiffCacheControl(context.forceRefresh) }
		});
	} catch (err) {
		handleDiffRouteError(err);
	}
};
