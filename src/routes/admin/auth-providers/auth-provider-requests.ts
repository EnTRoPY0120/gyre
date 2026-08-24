import { getCsrfToken } from '$lib/utils/csrf';

function getMessageFromResponseData(data: unknown, fallbackMessage: string): string {
	const message = (data as { message?: unknown } | null)?.message;
	if (typeof message !== 'string') return fallbackMessage;
	return message || fallbackMessage;
}

async function getMutationErrorMessage(
	response: Response,
	fallbackMessage: string
): Promise<string> {
	try {
		return getMessageFromResponseData(await response.json(), fallbackMessage);
	} catch {
		// Keep the operation-specific fallback when the response is not JSON.
		return fallbackMessage;
	}
}

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

	throw new Error(await getMutationErrorMessage(response, fallbackMessage));
}
