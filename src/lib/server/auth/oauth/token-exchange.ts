import { decryptSecret } from '$lib/server/auth/crypto';
import { OAuthError, type OAuthTokens } from './types';

export type OAuthErrorCode = 'TOKEN_EXCHANGE_FAILED' | 'TOKEN_REFRESH_FAILED';

export interface BasicOAuthTokenExchangeOptions {
	clientId: string;
	clientSecretEncrypted: string;
	endpoint: string;
	body: URLSearchParams;
	missingAccessTokenMessage: string;
	errorMessagePrefix: string;
	errorCode: OAuthErrorCode;
}

export async function exchangeOAuthTokenWithBasicAuth(
	options: BasicOAuthTokenExchangeOptions
): Promise<OAuthTokens> {
	const clientSecret = decryptSecret(options.clientSecretEncrypted);
	const credentials = Buffer.from(`${options.clientId}:${clientSecret}`).toString('base64');
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10_000);

	try {
		const response = await fetch(options.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
				Authorization: `Basic ${credentials}`
			},
			body: options.body.toString(),
			signal: controller.signal
		});
		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${await response.text()}`);
		}

		const data = await response.json();

		if (data.error) {
			throw new Error(data.error_description ?? data.error);
		}

		if (!data.access_token) {
			throw new Error(options.missingAccessTokenMessage);
		}

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
			tokenType: data.token_type ?? 'Bearer',
			scope: data.scope
		};
	} catch (error) {
		clearTimeout(timeoutId);
		throw new OAuthError(
			`${options.errorMessagePrefix}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			options.errorCode,
			error
		);
	}
}
