const PUBLIC_ROUTES = [
	'/login',
	'/api/health',
	'/api/v1/health',
	'/api/ready',
	'/api/v1/ready',
	'/api/auth/login',
	'/api/v1/auth/login',
	'/api/flux/health',
	'/api/v1/flux/health',
	'/metrics',
	'/manifest.json',
	'/robots.txt',
	'/favicon.ico',
	'/logo.svg'
];

export const STATIC_PATTERNS = [
	/^\/_app\//,
	/^\/fonts\//,
	/^\/images\//,
	/^\/(?:favicon\.svg|social-preview\.(?:svg|png)|manifest\.json|robots\.txt|service-worker\.js|favicon\.ico|logo\.svg)$/
];

export function isStaticAssetPath(path: string): boolean {
	// API resource names may contain dots (including extensions such as .js).
	// Never classify an API path as a public static asset.
	return !path.startsWith('/api/') && STATIC_PATTERNS.some((pattern) => pattern.test(path));
}

const PUBLIC_OAUTH_ROUTE_PATTERN = /^\/api(?:\/v1)?\/auth\/[^/]+\/(?:login|callback)\/?$/;

export function isPublicRoute(path: string): boolean {
	if (
		PUBLIC_ROUTES.some((route) => {
			if (route.endsWith('/*')) {
				const prefix = route.slice(0, -2);
				return path === prefix || path.startsWith(prefix + '/');
			}

			return path === route;
		})
	) {
		return true;
	}

	if (PUBLIC_OAUTH_ROUTE_PATTERN.test(path)) {
		return true;
	}

	if (isStaticAssetPath(path)) {
		return true;
	}

	return false;
}
