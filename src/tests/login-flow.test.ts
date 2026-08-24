import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	getLoginDestination,
	getLoginErrorState,
	getPostLoginRedirect,
	getProviderColor,
	getProviderIcon,
	LoginRequestError,
	submitLogin,
	validateLoginCredentials
} from '../lib/auth/login-flow.js';

describe('login flow helpers', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	test('validates credentials and returns field-level errors', () => {
		expect(validateLoginCredentials('', '')).toEqual({
			errors: {
				username: 'Username is required',
				password: 'Password is required'
			},
			firstMessage: 'Username is required'
		});
		expect(validateLoginCredentials('admin', 'secret')).toEqual({ errors: {}, firstMessage: null });
	});

	test('keeps same-origin return targets and rejects external targets', () => {
		const currentUrl = 'https://gyre.example/login?returnTo=%2F';

		expect(getLoginDestination('/admin?tab=users#members', currentUrl)).toBe(
			'/admin?tab=users#members'
		);
		expect(getLoginDestination('https://gyre.example/admin', currentUrl)).toBe('/admin');
		expect(getLoginDestination('https://evil.example/phish', currentUrl)).toBe('/');
		expect(getLoginDestination('javascript:alert(1)', currentUrl)).toBe('/');
		expect(getLoginDestination(null, currentUrl)).toBe('/');
	});

	test('forces first-login users through password change before returnTo', () => {
		const currentUrl = 'https://gyre.example/login?returnTo=%2Fadmin';

		expect(
			getPostLoginRedirect(
				{ user: { requiresPasswordChange: true, canChangePassword: true } },
				'/admin',
				currentUrl
			)
		).toBe('/change-password?first=true');
		expect(
			getPostLoginRedirect({ user: { requiresPasswordChange: false } }, '/admin', currentUrl)
		).toBe('/admin');
	});

	test('submits credentials and preserves structured login errors', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ message: { message: 'Invalid password' } }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(submitLogin('admin', 'wrong')).rejects.toEqual(
			new LoginRequestError('Invalid password', 401)
		);
		expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: 'admin', password: 'wrong' })
		});
	});

	test('maps provider presentation metadata with safe defaults', () => {
		expect(getProviderIcon('oauth2-github')).toBe('github');
		expect(getProviderIcon('unknown')).toBe('key');
		expect(getProviderColor('oauth2-gitlab')).toBe('provider-gitlab');
		expect(getProviderColor('unknown')).toBe('provider-oidc');
	});

	test('converts login failures into form and toast state', () => {
		expect(getLoginErrorState(new LoginRequestError('Invalid password', 401))).toEqual({
			password: 'Invalid password',
			message: 'Invalid password'
		});
		expect(getLoginErrorState(new LoginRequestError('Service unavailable', 503))).toEqual({
			message: 'Service unavailable'
		});
		expect(getLoginErrorState('unknown failure')).toEqual({ message: 'Login failed' });
	});
});
