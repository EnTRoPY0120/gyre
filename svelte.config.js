import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// @sveltejs/adapter-node v5 controls body size via the BODY_SIZE_LIMIT env var
		// (default 512KB), not via a code option. We set BODY_SIZE_LIMIT=500M in the
		// Dockerfile as a hard ceiling (matching the largest allowed upload) so that
		// per-endpoint limits in hooks.server.ts apply within that cap, including for
		// clients that omit Content-Length. See request-limits.ts for size constants.
		adapter: adapter()
	}
};

export default config;
