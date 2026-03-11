import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Request size limits are enforced in src/hooks.server.ts via Content-Length validation.
		// See src/lib/server/request-limits.ts for per-endpoint size constants.
		adapter: adapter()
	}
};

export default config;
