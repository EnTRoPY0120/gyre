import { getCsrfToken } from '$lib/utils/csrf';
import type { AuthProviderFormData } from '$lib/components/admin/auth-provider';
import { buildAuthProviderUpdates, normalizeRoleMappingForSave } from './form-helpers';

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

type AuthProviderMutationRequester = typeof requestAuthProviderMutation;

export async function updateAuthProvider(
	providerId: string,
	formData: AuthProviderFormData,
	request: AuthProviderMutationRequester = requestAuthProviderMutation
): Promise<void> {
	const roleMapping = normalizeRoleMappingForSave(formData.roleMapping);
	const updates = buildAuthProviderUpdates(formData, roleMapping);

	await request(
		`/api/v1/admin/auth-providers/${providerId}`,
		{
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		},
		'Failed to update provider'
	);
}
