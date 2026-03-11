import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// @sveltejs/adapter-node v5 does not expose a bodyParser option, so there is
		// no framework-level body size cap to configure here. Request size limits are
		// enforced early in src/hooks.server.ts via Content-Length validation.
		// See src/lib/server/request-limits.ts for per-endpoint size constants.
		adapter: adapter()
	}
};

export default config;
