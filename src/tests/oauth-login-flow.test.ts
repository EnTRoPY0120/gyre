import { describe, expect, test, vi } from 'vitest';
import { OAuthError } from '../lib/server/auth/oauth/types.js';
import {
	createOAuthLoginUrl,
	handleOAuthLoginError
} from '../routes/api/v1/auth/[providerId]/login/oauth-login-flow.js';

function createCookies() {
	const values: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
	return {
		values,
		cookies: {
			set(name: string, value: string, options: Record<string, unknown>) {
				values.push({ name, value, options });
			}
		}
	};
}

function captureThrown(callback: () => unknown): unknown {
	try {
		callback();
	} catch (error) {
		return error;
	}
	return undefined;
}

describe('createOAuthLoginUrl', () => {
	test('generates state and verifier cookies before returning the provider URL', async () => {
		const { cookies, values } = createCookies();
		const getProvider = vi.fn().mockResolvedValue({
			getAuthorizationUrl: vi.fn().mockResolvedValue(new URL('https://idp.example.com/authorize'))
		});

		await expect(
			createOAuthLoginUrl('provider-1', cookies, {
				getProvider,
				generateState: () => 'state-1',
				generateCodeVerifier: () => 'verifier-1'
			})
		).resolves.toBe('https://idp.example.com/authorize');
		expect(getProvider).toHaveBeenCalledWith('provider-1');
		expect(values).toEqual([
			expect.objectContaining({
				name: 'oauth_state_provider-1',
				value: 'state-1',
				options: expect.objectContaining({ maxAge: 600 })
			}),
			expect.objectContaining({
				name: 'oauth_verifier_provider-1',
				value: 'verifier-1',
				options: expect.objectContaining({ maxAge: 600 })
			})
		]);
	});
});

describe('handleOAuthLoginError', () => {
	test('maps provider availability errors', () => {
		expect(
			captureThrown(() => handleOAuthLoginError(new OAuthError('missing', 'PROVIDER_NOT_FOUND')))
		).toMatchObject({
			status: 404,
			body: { message: 'Authentication provider not found' }
		});
		expect(
			captureThrown(() => handleOAuthLoginError(new OAuthError('disabled', 'PROVIDER_DISABLED')))
		).toMatchObject({
			status: 403,
			body: { message: 'Authentication provider is disabled' }
		});
	});

	test('uses OAuth-specific and generic fallbacks', () => {
		expect(
			captureThrown(() => handleOAuthLoginError(new OAuthError('bad config', 'INVALID')))
		).toMatchObject({
			status: 500,
			body: { message: 'OAuth error: bad config' }
		});
		expect(captureThrown(() => handleOAuthLoginError(new Error('unexpected')))).toMatchObject({
			status: 500,
			body: { message: 'Failed to initiate login' }
		});
	});
});
