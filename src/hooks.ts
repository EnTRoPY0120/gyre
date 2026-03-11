import type { Reroute } from '@sveltejs/kit';

/**
 * Shared reroute hook for SvelteKit.
 * Handles internal routing rewrites for API versioning backward compatibility.
 */
export const reroute: Reroute = ({ url }) => {
	const { pathname } = url;

	// If it's an API call but not already versioned, documentation, or static assets
	if (
		pathname.startsWith('/api/') &&
		!pathname.startsWith('/api/v1/') &&
		!pathname.startsWith('/api/docs/')
	) {
		// Rewrite /api/* to /api/v1/*
		// Example: /api/auth/login -> /api/v1/auth/login
		return `/api/v1${pathname.substring(4)}`;
	}
};
