import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_LOG_LEVEL: {
		public: true,
		static: false,
		schema: (value) => value
	},
	KUBERNETES_SERVICE_HOST: {
		static: false,
		schema: (value) => value
	},
	NODE_ENV: {
		static: false,
		schema: (value) => value
	}
});
