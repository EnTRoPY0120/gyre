/**
 * OAuth2/OIDC Provider Module
 * Central exports for all OAuth functionality
 */

// Types
export type {
	IOAuthProvider,
	OAuthTokens,
	OAuthUserInfo,
	OIDCDiscovery,
	OAuthProviderOptions
} from './types';
export { OAuthError, ProviderType } from './types';

// Providers
export { OIDCProvider } from './providers/oidc';
export { GitHubProvider } from './providers/github';
export { GitLabProvider } from './providers/gitlab';
export { GoogleProvider } from './providers/google';

// Factory functions
export {
	createOAuthProvider,
	getAuthProviderById,
	getEnabledAuthProviders,
	getOAuthProvider,
	validateProviderConfig
} from './factory';
