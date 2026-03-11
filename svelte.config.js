import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Configure body parser limits
			// Note: These are soft limits; actual enforcement is done in hooks.server.ts
			// to allow different limits for different endpoints
			bodyParser: {
				// Default body size limit for JSON payloads (1MB)
				sizeLimit: 1048576, // 1MB
				// Enable streaming for large uploads
				streaming: true
			}
		})
	}
};

export default config;
