import { logger } from './logger.js';

interface RetryOptions {
	maxRetries: number;
	initialDelay: number;
	retryOnStatus: number[];
	fetchFn: typeof fetch;
	logger: { warn: (msg: string) => void };
}

function retryDelay(initialDelay: number, attempt: number): number {
	return initialDelay * Math.pow(2, attempt);
}

async function waitForRetry(delay: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, delay));
}

async function retryAfterResponse(
	response: Response,
	attempt: number,
	options: RetryOptions
): Promise<void> {
	const delay = retryDelay(options.initialDelay, attempt);
	options.logger.warn(
		`Fetch attempt ${attempt + 1} failed with status ${response.status}. Retrying in ${delay}ms...`
	);
	await waitForRetry(delay);
}

async function retryAfterNetworkError(attempt: number, options: RetryOptions): Promise<void> {
	const delay = retryDelay(options.initialDelay, attempt);
	options.logger.warn(
		`Fetch attempt ${attempt + 1} failed with network error. Retrying in ${delay}ms...`
	);
	await waitForRetry(delay);
}

/**
 * Fetch with exponential backoff retry logic for resilience
 */
export async function fetchWithRetry(
	input: RequestInfo | URL,
	init?: RequestInit,
	options: {
		maxRetries?: number;
		initialDelay?: number;
		retryOnStatus?: number[];
		/** Optional custom fetch function (e.g., from SvelteKit load) */
		fetchFn?: typeof fetch;
		/** Optional custom logger */
		logger?: { warn: (msg: string) => void };
	} = {}
): Promise<Response> {
	const {
		maxRetries = 3,
		initialDelay = 1000,
		retryOnStatus = [503, 504],
		fetchFn = typeof window !== 'undefined' ? window.fetch : fetch,
		logger: customLogger
	} = options;
	const retryOptions: RetryOptions = {
		maxRetries,
		initialDelay,
		retryOnStatus,
		fetchFn,
		logger: customLogger ?? logger
	};

	let lastResponse: Response | undefined;
	let lastError: unknown;

	for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
		try {
			// Use provided fetch function or global fetch
			const response = await retryOptions.fetchFn(input, init);
			lastResponse = response;

			// If response is successful or shouldn't be retried, return it
			if (
				response.ok ||
				!retryOptions.retryOnStatus.includes(response.status) ||
				attempt === retryOptions.maxRetries
			) {
				return response;
			}

			await retryAfterResponse(response, attempt, retryOptions);
		} catch (error) {
			lastError = error;

			// Always retry on network errors (fetch throws for network errors)
			if (attempt === retryOptions.maxRetries) break;
			await retryAfterNetworkError(attempt, retryOptions);
		}
	}

	if (lastResponse) {
		return lastResponse;
	}
	throw lastError;
}
