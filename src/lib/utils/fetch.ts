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
	} = {}
): Promise<Response> {
	const {
		maxRetries = 3,
		initialDelay = 1000,
		retryOnStatus = [503, 504],
		fetchFn = typeof window !== 'undefined' ? window.fetch : fetch
	} = options;

	let lastResponse: Response | undefined;
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			// Use provided fetch function or global fetch
			const response = await fetchFn(input, init);
			lastResponse = response;

			// If response is successful or shouldn't be retried, return it
			if (response.ok || !retryOnStatus.includes(response.status)) {
				return response;
			}

			// It's a retryable status code
			if (attempt < maxRetries) {
				const delay = initialDelay * Math.pow(2, attempt);
				console.warn(
					`Fetch attempt ${attempt + 1} failed with status ${response.status}. Retrying in ${delay}ms...`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
		} catch (error) {
			lastError = error;

			// Always retry on network errors (fetch throws for network errors)
			if (attempt < maxRetries) {
				const delay = initialDelay * Math.pow(2, attempt);
				console.warn(
					`Fetch attempt ${attempt + 1} failed with network error. Retrying in ${delay}ms...`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
		}
	}

	if (lastResponse) {
		return lastResponse;
	}
	throw lastError;
}
