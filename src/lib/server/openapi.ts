import { z } from 'zod';
import {
	OpenApiGeneratorV3,
	OpenAPIRegistry,
	extendZodWithOpenApi
} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export { z };

/** Security requirement for endpoints that require authentication */
export const SESSION_SECURITY = [{ CookieAuth: [] }];

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
		description: 'Session cookie obtained after successful login via POST /api/auth/login'
	});

	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: '3.0.0',
		info: {
			title: 'Gyre API',
			version: '0.1.0',
			description: 'Internal APIs for Gyre - FluxCD Web UI'
		},
		servers: [{ url: '/' }],
		security: [{ CookieAuth: [] }]
	});
}
