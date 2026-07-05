import { z } from '$lib/server/openapi';
import { getFluxResourceEvents } from '$lib/server/flux/use-cases/resource-actions.js';
import { createFluxResourceReadMetadata } from '$lib/server/openapi/flux-route-metadata.js';
import type { RequestHandler } from './$types';

const eventSchema = z.object({
	type: z.string().openapi({ example: 'Normal' }),
	reason: z.string().openapi({ example: 'ReconciliationSucceeded' }),
	message: z.string().openapi({ example: 'Applied revision: main@sha1:abc1234' }),
	firstTimestamp: z.string().nullable().optional().openapi({ example: '2024-01-15T10:00:00Z' }),
	lastTimestamp: z.string().nullable().optional().openapi({ example: '2024-01-15T10:30:00Z' }),
	count: z.number().openapi({ example: 3 }),
	involvedObject: z.object({
		kind: z.string().openapi({ example: 'Kustomization' }),
		name: z.string().openapi({ example: 'my-app' }),
		namespace: z.string(),
		uid: z.string()
	}),
	source: z.object({ component: z.string() })
});

export const _metadata = {
	GET: createFluxResourceReadMetadata({
		summary: 'Get resource events',
		description: 'Retrieve Kubernetes events associated with a specific FluxCD resource.',
		responseDescription: 'Events for the resource',
		responseSchema: z.object({ events: z.array(eventSchema) }),
		includeInternalServerError: true
	})
};

export const GET: RequestHandler = ({ params, locals }) =>
	getFluxResourceEvents({ params, locals });
