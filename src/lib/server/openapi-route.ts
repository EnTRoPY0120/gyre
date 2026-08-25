import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi';

type RouteModule = {
	_metadata?: Record<string, RouteConfig>;
};

function getRouteMetadata(module: unknown): Record<string, RouteConfig> | undefined {
	if (typeof module !== 'object' || module === null || !('_metadata' in module)) return undefined;

	const metadata = (module as RouteModule)._metadata;
	return metadata && typeof metadata === 'object' ? metadata : undefined;
}

export function toOpenApiPath(routePath: string): string {
	return routePath
		.replace('/src/routes', '')
		.replace('/+server.ts', '')
		.replace(/\[(\w+)\]/g, '{$1}');
}

export function registerApiRoutes(
	registry: OpenAPIRegistry,
	apiRoutes: Record<string, unknown>
): void {
	for (const [routePath, module] of Object.entries(apiRoutes)) {
		const metadata = getRouteMetadata(module);
		if (!metadata) continue;

		for (const [method, config] of Object.entries(metadata)) {
			registry.registerPath({
				...config,
				method: method.toLowerCase() as RouteConfig['method'],
				path: toOpenApiPath(routePath)
			});
		}
	}
}
