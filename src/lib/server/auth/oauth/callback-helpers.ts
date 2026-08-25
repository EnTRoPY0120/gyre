import { OAuthError } from './index.js';
import type { SSOUserResult } from '../sso.js';

export function getSsoLoginErrorMessage(reason: SSOUserResult['reason']): string {
	const messages: Record<NonNullable<SSOUserResult['reason']>, string> = {
		signup_disabled:
			'New account registration is not available. Please contact your administrator.',
		domain_not_allowed: 'Your email domain is not authorized for this application.',
		auto_provision_disabled:
			'Account auto-provisioning is disabled. Please contact your administrator.',
		user_not_found: 'Your user account could not be found. Please contact your administrator.',
		user_disabled: 'Your account has been disabled. Please contact your administrator.'
	};
	return (
		(reason && messages[reason]) || 'Authentication failed. Please contact your administrator.'
	);
}

export function getOAuthCallbackErrorMessage(error: unknown): string {
	if (!(error instanceof OAuthError)) return 'Authentication failed';

	const messages: Partial<Record<OAuthError['code'], string>> = {
		PROVIDER_NOT_FOUND: 'Authentication provider not found',
		PROVIDER_DISABLED: 'Authentication provider is disabled',
		TOKEN_EXCHANGE_FAILED: 'Failed to exchange authorization code for token',
		USERINFO_FAILED: 'Failed to fetch user information from provider',
		INVALID_ID_TOKEN: 'Invalid ID token from provider'
	};
	return messages[error.code] ?? `OAuth error: ${error.message}`;
}
