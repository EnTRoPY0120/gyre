import { z } from 'zod';
import {
	OpenApiGeneratorV3,
	OpenAPIRegistry,
	extendZodWithOpenApi
} from '@asteasolutions/zod-to-openapi';
import { GYRE_VERSION } from '$lib/config/version';

extendZodWithOpenApi(z);

export { z };

/** Shared schema for structured API error responses */
export const errorSchema = z.object({ message: z.string(), code: z.string() });

/**
 * Creates a new OpenAPI registry
 */
export function createRegistry() {
	return new OpenAPIRegistry();
}

/**
 * Base OpenAPI definition
 */
export function generateOpenApiSpec(registry: OpenAPIRegistry) {
	registry.registerComponent('securitySchemes', 'CookieAuth', {
		type: 'apiKey',
		in: 'cookie',
		name: 'gyre_session',
		description: 'Session cookie obtained after successful login via POST /api/v1/auth/login'
	});

	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: '3.0.0',
		info: {
			title: 'Gyre API',
			version: GYRE_VERSION,
			description: 'Internal APIs for Gyre - FluxCD Web UI'
		},
		servers: [{ url: '/' }],
		security: [{ CookieAuth: [] }]
	});
}
