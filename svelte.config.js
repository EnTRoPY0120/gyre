import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// @sveltejs/adapter-node v5 controls body size via the BODY_SIZE_LIMIT env var
		// (default 512KB), not via a code option. We set BODY_SIZE_LIMIT=Infinity in
		// the Dockerfile so that per-endpoint limits in hooks.server.ts are the sole
		// enforcement point. See src/lib/server/request-limits.ts for size constants.
		adapter: adapter()
	}
};

export default config;
