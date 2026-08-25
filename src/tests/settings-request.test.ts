import { describe, expect, test, vi } from 'vitest';
import {
	buildSettingsUpdate,
	saveAdminSettings
} from '../routes/admin/settings/settings-request.js';

const state = {
	localLoginEnabled: true,
	allowSignup: false,
	domainAllowlistText: ' Example.COM, ,internal.example.com ',
	auditRetentionDays: 30
};

describe('admin settings request policy', () => {
	test('normalizes the comma-separated domain allowlist', () => {
		expect(buildSettingsUpdate(state)).toEqual({
			localLoginEnabled: true,
			allowSignup: false,
			domainAllowlist: ['example.com', 'internal.example.com'],
			auditRetentionDays: 30
		});
	});

	test('sends the normalized payload with the CSRF token', async () => {
		const fetcher = vi.fn().mockResolvedValue({ ok: true });

		await saveAdminSettings(state, 'csrf-token', fetcher);

		expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/settings', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token' },
			body: JSON.stringify(buildSettingsUpdate(state))
		});
	});

	test('surfaces the API error message and uses a fallback when absent', async () => {
		const response = { ok: false, json: async () => ({ message: 'Invalid retention period' }) };
		await expect(
			saveAdminSettings(state, 'csrf-token', vi.fn().mockResolvedValue(response))
		).rejects.toThrow('Invalid retention period');

		const fallbackResponse = { ok: false, json: async () => ({}) };
		await expect(
			saveAdminSettings(state, 'csrf-token', vi.fn().mockResolvedValue(fallbackResponse))
		).rejects.toThrow('Failed to save settings');
	});
});
