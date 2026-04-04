const PUBLIC_ROUTES = [
	'/login',
	'/api/health',
	'/api/v1/health',
	'/api/auth/login',
	'/api/v1/auth/login',
	'/api/flux/health',
	'/api/v1/flux/health',
	'/metrics',
	'/manifest.json',
	'/favicon.ico',
	'/logo.svg'
];

export const STATIC_PATTERNS = [
	/^\/_app\//,
	/^\/fonts\//,
	/^\/images\//,
	/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/
];

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

	if (STATIC_PATTERNS.some((pattern) => pattern.test(path))) {
		return true;
	}

	return false;
}
