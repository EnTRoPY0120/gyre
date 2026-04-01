import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// @sveltejs/adapter-node v5 controls body size via the BODY_SIZE_LIMIT env var
		// (default 512KB), not via a code option. We set BODY_SIZE_LIMIT=500M in the
		// Dockerfile as a hard ceiling (matching the largest allowed upload) so that
		// per-endpoint limits in hooks.server.ts apply within that cap, including for
		// clients that omit Content-Length. See request-limits.ts for size constants.
		adapter: adapter(),
		csp: {
			// Use nonce mode so SvelteKit injects per-request nonces into its inline
			// hydration scripts instead of relying on 'unsafe-inline'.
			mode: 'nonce',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'], // SvelteKit appends 'nonce-<value>' automatically
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self', 'data:'],
				'connect-src': ['self'],
				'worker-src': ['self'], // Monaco workers bundled locally, served from same origin
				'frame-ancestors': ['none'],
				'object-src': ['none'],
				'base-uri': ['self']
			}
		}
	}
};

export default config;
