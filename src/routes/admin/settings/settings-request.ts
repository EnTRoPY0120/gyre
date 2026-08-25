export interface SettingsFormState {
	localLoginEnabled: boolean;
	allowSignup: boolean;
	domainAllowlistText: string;
	auditRetentionDays: number;
}

export function buildSettingsUpdate(state: SettingsFormState) {
	return {
		localLoginEnabled: state.localLoginEnabled,
		allowSignup: state.allowSignup,
		domainAllowlist: state.domainAllowlistText
			.split(',')
			.map((domain) => domain.trim().toLowerCase())
			.filter((domain) => domain.length > 0),
		auditRetentionDays: state.auditRetentionDays
	};
}

export async function saveAdminSettings(
	state: SettingsFormState,
	csrfToken: string,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher('/api/v1/admin/settings', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
		body: JSON.stringify(buildSettingsUpdate(state))
	});

	if (response.ok) return;

	const errorResponse = (await response.json()) as { message?: string };
	throw new Error(errorResponse.message || 'Failed to save settings');
}
