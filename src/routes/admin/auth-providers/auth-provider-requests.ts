import { getCsrfToken } from '$lib/utils/csrf';

export async function requestAuthProviderMutation(
	url: string,
	options: RequestInit,
	fallbackMessage: string
): Promise<void> {
	const response = await fetch(url, {
		...options,
		headers: {
			...options.headers,
			'X-CSRF-Token': getCsrfToken()
		}
	});

	if (response.ok) return;

	let message = fallbackMessage;
	try {
		const data = await response.json();
		if (typeof data?.message === 'string' && data.message) message = data.message;
	} catch {
		// Keep the operation-specific fallback when the response is not JSON.
	}
	throw new Error(message);
}
