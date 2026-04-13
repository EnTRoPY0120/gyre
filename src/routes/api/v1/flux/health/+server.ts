import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { getFluxHealthSummary } from '$lib/server/flux/services.js';
import { setPrivateCacheHeaders } from '$lib/server/http/transport.js';

export const _metadata = {
	GET: {
		summary: 'Health check',
		description:
			'Check Kubernetes cluster connectivity. Returns basic status when unauthenticated, or detailed cluster info when authenticated. Results are cached for 30 seconds.',
		tags: ['Flux'],
		security: [],
		responses: {
			200: {
				description: 'Cluster is healthy',
				content: {
					'application/json': {
						schema: z.union([
							z.object({ status: z.literal('healthy') }),
							z.object({
								status: z.literal('healthy'),
								kubernetes: z.object({
									connected: z.boolean(),
									configStrategy: z.enum(['in-cluster', 'local-kubeconfig']),
									configSource: z.enum(['ServiceAccount', 'kubeconfig']),
									currentContext: z.string(),
									availableContexts: z.array(z.string()),
									connectionPool: z.object({
										hits: z.number(),
										misses: z.number(),
										evictions: z.number(),
										poolSizes: z.object({
											customObjects: z.number(),
											coreV1: z.number(),
											appsV1: z.number()
										})
									})
								})
							})
						])
					}
				}
			},
			503: {
				description: 'Unable to connect to Kubernetes cluster',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			}
		}
	}
};
/**
 * GET /api/flux/health
 * Health check endpoint that validates K8s connection
 */
export const GET: RequestHandler = async ({ setHeaders, locals }) => {
	try {
		const responseData = await getFluxHealthSummary({
			locals,
			includeDetails: Boolean(locals.user)
		});

		if (locals.user) {
			setPrivateCacheHeaders(setHeaders, 'private, max-age=30');
		}

		return json(responseData);
	} catch (err) {
		handleApiError(err, 'Kubernetes health check failed');
	}
};
