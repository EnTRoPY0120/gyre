import { z } from '$lib/server/openapi';

export const fluxResourceParamsSchema = z.object({
	resourceType: z.string().openapi({ example: 'gitrepositories' }),
	namespace: z.string().openapi({ example: 'flux-system' }),
	name: z.string().openapi({ example: 'my-repo' })
});

const fluxActionSuccessSchema = z.object({ success: z.boolean(), message: z.string() });

const authResponses = {
	401: { description: 'Authentication required' },
	403: { description: 'Permission denied' }
};

export function createFluxResourceActionMetadata(options: {
	summary: string;
	description: string;
	successDescription: string;
	includeInternalServerError?: boolean;
}) {
	return {
		summary: options.summary,
		description: options.description,
		tags: ['Flux'],
		request: {
			params: fluxResourceParamsSchema
		},
		responses: {
			200: {
				description: options.successDescription,
				content: {
					'application/json': {
						schema: fluxActionSuccessSchema
					}
				}
			},
			400: { description: 'Invalid namespace or resource name' },
			...authResponses,
			...(options.includeInternalServerError
				? { 500: { description: 'Internal server error' } }
				: {})
		}
	};
}

export function createFluxResourceReadMetadata(options: {
	summary: string;
	description: string;
	responseDescription: string;
	responseSchema: z.ZodType;
	includeInternalServerError?: boolean;
}) {
	return {
		summary: options.summary,
		description: options.description,
		tags: ['Flux'],
		request: {
			params: fluxResourceParamsSchema
		},
		responses: {
			200: {
				description: options.responseDescription,
				content: {
					'application/json': {
						schema: options.responseSchema
					}
				}
			},
			400: { description: 'Invalid resource type' },
			...authResponses,
			...(options.includeInternalServerError
				? { 500: { description: 'Internal server error' } }
				: {})
		}
	};
}
