import { z } from 'zod';
import {
	OpenApiGeneratorV3,
	OpenAPIRegistry,
	extendZodWithOpenApi
} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export { z };

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
	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: '3.0.0',
		info: {
			title: 'Gyre API',
			version: '0.1.0',
			description: 'Internal APIs for Gyre - FluxCD Web UI'
		},
		servers: [{ url: '/' }]
	});
}
