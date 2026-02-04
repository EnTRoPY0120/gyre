/**
 * OAuth Provider Factory
 * Creates the appropriate OAuth provider based on configuration.
 */

import type { AuthProvider } from '$lib/server/db/schema';
import type { IOAuthProvider } from './types';
import { OAuthError, ProviderType } from './types';
import { OIDCProvider } from './providers/oidc';
import { GitHubProvider } from './providers/github';
import { GoogleProvider } from './providers/google';
import { getDb } from '$lib/server/db';
import { authProviders } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Create an OAuth provider instance from configuration
 *
 * @param config - Provider configuration from database
 * @param redirectUri - Optional override for redirect URI
 * @returns OAuth provider instance
 */
export function createOAuthProvider(
	config: AuthProvider,
	redirectUri?: string
): IOAuthProvider {
	const options = { config, redirectUri };

	switch (config.type) {
		case ProviderType.OIDC:
			return new OIDCProvider(options);

		case ProviderType.OAUTH2_GITHUB:
			return new GitHubProvider(options);

		case ProviderType.OAUTH2_GOOGLE:
			return new GoogleProvider(options);

		case ProviderType.OAUTH2_GITLAB:
			// TODO: Implement GitLab provider
			throw new OAuthError(
				'GitLab provider not yet implemented',
				'PROVIDER_NOT_IMPLEMENTED'
			);

		case ProviderType.OAUTH2_GENERIC:
			// Generic OAuth2 falls back to OIDC provider
			// (most modern OAuth2 providers support OIDC discovery)
			return new OIDCProvider(options);

		default:
			throw new OAuthError(`Unknown provider type: ${config.type}`, 'UNKNOWN_PROVIDER_TYPE');
	}
}

/**
 * Get provider configuration from database by ID
 *
 * @param providerId - Provider ID
 * @returns Provider configuration or null if not found
 */
export async function getAuthProviderById(
	providerId: string
): Promise<AuthProvider | null> {
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

/**
 * Validate provider configuration
 * Checks for required fields based on provider type
 *
 * @param config - Provider configuration to validate
 * @returns Validation result with errors if any
 */
export function validateProviderConfig(config: Partial<AuthProvider>): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Required fields for all providers
	if (!config.name?.trim()) {
		errors.push('Name is required');
	}
	if (!config.type) {
		errors.push('Provider type is required');
	}
	if (!config.clientId?.trim()) {
		errors.push('Client ID is required');
	}
	if (!config.clientSecretEncrypted?.trim()) {
		errors.push('Client Secret is required');
	}

	// Type-specific validation
	if (config.type === ProviderType.OIDC || config.type === ProviderType.OAUTH2_GENERIC) {
		if (!config.issuerUrl?.trim()) {
			errors.push('Issuer URL is required for OIDC providers');
		} else {
			// Validate URL format
			try {
				new URL(config.issuerUrl);
			} catch {
				errors.push('Issuer URL must be a valid URL');
			}
		}
	}

	// Validate scopes
	if (config.scopes) {
		const scopes = config.scopes.split(' ').filter(Boolean);
		if (scopes.length === 0) {
			errors.push('At least one scope is required');
		}
	}

	// Validate role mapping JSON if provided
	if (config.roleMapping) {
		try {
			const mapping = JSON.parse(config.roleMapping);
			if (typeof mapping !== 'object' || mapping === null) {
				errors.push('Role mapping must be a valid JSON object');
			}
		} catch {
			errors.push('Role mapping must be valid JSON');
		}
	}

	// Validate claim paths
	if (config.roleClaim && !/^[\w.]+$/.test(config.roleClaim)) {
		errors.push('Role claim path contains invalid characters');
	}
	if (config.usernameClaim && !/^[\w.]+$/.test(config.usernameClaim)) {
		errors.push('Username claim path contains invalid characters');
	}
	if (config.emailClaim && !/^[\w.]+$/.test(config.emailClaim)) {
		errors.push('Email claim path contains invalid characters');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}
