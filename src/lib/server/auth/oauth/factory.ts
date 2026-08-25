/**
 * OAuth Provider Factory
 * Creates the appropriate OAuth provider based on configuration.
 */

import type { AuthProvider } from '$lib/server/db/schema';
import type { IOAuthProvider } from './types';
import { OAuthError, ProviderType } from './types';
import { OIDCProvider } from './providers/oidc';
import { GitHubProvider } from './providers/github';
import { GitLabProvider } from './providers/gitlab';
import { GoogleProvider } from './providers/google';
import { getDb } from '$lib/server/db';
import { authProviders } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
export { validateProviderConfig } from './provider-config-validation.js';

type ProviderOptions = { config: AuthProvider; redirectUri?: string };
type ProviderFactory = (options: ProviderOptions) => IOAuthProvider;

const providerFactories: Record<string, ProviderFactory> = {
	[ProviderType.OIDC]: (options) => new OIDCProvider(options),
	[ProviderType.OAUTH2_GITHUB]: (options) => new GitHubProvider(options),
	[ProviderType.OAUTH2_GOOGLE]: (options) => new GoogleProvider(options),
	[ProviderType.OAUTH2_GITLAB]: (options) => GitLabProvider(options),
	[ProviderType.OAUTH2_GENERIC]: (options) => new OIDCProvider(options)
};

/**
 * Create an OAuth provider instance from configuration
 *
 * @param config - Provider configuration from database
 * @param redirectUri - Optional override for redirect URI
 * @returns OAuth provider instance
 */
function createOAuthProvider(config: AuthProvider, redirectUri?: string): IOAuthProvider {
	const options = { config, redirectUri };
	const factory = providerFactories[config.type];
	if (!factory) {
		throw new OAuthError(`Unknown provider type: ${config.type}`, 'UNKNOWN_PROVIDER_TYPE');
	}
	return factory(options);
}

/**
 * Get provider configuration from database by ID
 *
 * @param providerId - Provider ID
 * @returns Provider configuration or null if not found
 */
async function getAuthProviderById(providerId: string): Promise<AuthProvider | null> {
	const db = await getDb();
	const provider = await db.query.authProviders.findFirst({
		where: eq(authProviders.id, providerId)
	});
	return provider || null;
}

/**
 * Get all enabled auth providers
 *
 * @returns Array of enabled providers
 */
export async function getEnabledAuthProviders(): Promise<AuthProvider[]> {
	const db = await getDb();
	const providers = await db.query.authProviders.findMany({
		where: eq(authProviders.enabled, true),
		orderBy: (authProviders, { asc }) => [asc(authProviders.name)]
	});
	return providers;
}

/**
 * Get provider and create OAuth client
 * Convenience function for endpoints
 *
 * @param providerId - Provider ID
 * @param redirectUri - Optional redirect URI override
 * @returns OAuth provider instance
 * @throws OAuthError if provider not found or disabled
 */
export async function getOAuthProvider(
	providerId: string,
	redirectUri?: string
): Promise<IOAuthProvider> {
	const config = await getAuthProviderById(providerId);

	if (!config) {
		throw new OAuthError('Provider not found', 'PROVIDER_NOT_FOUND');
	}

	if (!config.enabled) {
		throw new OAuthError('Provider is disabled', 'PROVIDER_DISABLED');
	}

	return createOAuthProvider(config, redirectUri);
}
