import { logger } from '$lib/server/logger.js';

let initialized = false;
let initializingPromise: Promise<void> | undefined;
let initializationState: 'not_started' | 'initializing' | 'ready' | 'failed' = 'not_started';
let failureMessage: string | undefined;

export function getGyreInitializationStatus(): {
	state: 'not_started' | 'initializing' | 'ready' | 'failed';
	message?: string;
} {
	return { state: initializationState, message: failureMessage };
}

export async function ensureGyreInitialized(): Promise<void> {
	if (initialized) {
		return;
	}

	if (initializationState === 'failed') {
		throw new Error(failureMessage ?? 'Gyre initialization failed');
	}

	if (!initializingPromise) {
		initializationState = 'initializing';
		failureMessage = undefined;
		initializingPromise = import('$lib/server/initialize.js')
			.then(({ initializeGyre }) => initializeGyre())
			.then(() => {
				initialized = true;
				initializationState = 'ready';
			})
			.catch((error) => {
				logger.error(error, 'Failed to initialize Gyre:');
				initializationState = 'failed';
				failureMessage = error instanceof Error ? error.message : 'Gyre initialization failed';
				throw error;
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
