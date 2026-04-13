import { initializeGyre } from '$lib/server/initialize.js';
import { logger } from '$lib/server/logger.js';

let initialized = false;
let initializingPromise: Promise<void> | undefined;

export async function ensureGyreInitialized(): Promise<void> {
	if (initialized) {
		return;
	}

	if (!initializingPromise) {
		initializingPromise = initializeGyre()
			.then(() => {
				initialized = true;
			})
			.catch((error) => {
				logger.error(error, 'Failed to initialize Gyre:');
				// Continue anyway - let the request fail naturally if DB is truly broken
			})
			.finally(() => {
				initializingPromise = undefined;
			});
	}

	await initializingPromise;
}

export function isGyreInitialized(): boolean {
	return initialized;
}
