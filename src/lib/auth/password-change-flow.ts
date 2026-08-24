export interface PasswordChangeRequest {
	currentPassword: string;
	newPassword: string;
}

interface PasswordChangeResponse {
	message?: string | { message?: string };
}

export async function submitPasswordChange(
	values: PasswordChangeRequest,
	csrfToken: string,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher('/api/v1/auth/change-password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
		body: JSON.stringify(values)
	});

	if (response.ok) return;

	const result = (await response.json().catch(() => ({}))) as PasswordChangeResponse;
	const message = typeof result.message === 'object' ? result.message.message : result.message;
	throw new Error(message || 'Failed to change password');
}
