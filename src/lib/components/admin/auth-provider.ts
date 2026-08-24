export type AuthProviderType =
	| 'oidc'
	| 'oauth2-github'
	| 'oauth2-google'
	| 'oauth2-gitlab'
	| 'oauth2-generic';

export type AuthProviderRole = 'admin' | 'editor' | 'viewer';

export interface AuthProviderFormData {
	name: string;
	type: AuthProviderType;
	enabled: boolean;
	clientId: string;
	clientSecret: string;
	issuerUrl: string;
	autoProvision: boolean;
	defaultRole: AuthProviderRole;
	roleMapping: string;
	roleClaim: string;
	usernameClaim: string;
	emailClaim: string;
	usePkce: boolean;
	scopes: string;
}

export interface AuthProviderSummary {
	id: string;
	name: string;
	type: AuthProviderType;
	enabled: boolean;
	clientId: string;
	issuerUrl: string | null;
	autoProvision: boolean;
	defaultRole: AuthProviderRole;
	usePkce: boolean;
	scopes: string;
}

export function createEmptyAuthProviderFormData(): AuthProviderFormData {
	return {
		name: '',
		type: 'oidc',
		enabled: true,
		clientId: '',
		clientSecret: '',
		issuerUrl: '',
		autoProvision: true,
		defaultRole: 'viewer',
		roleMapping: '',
		roleClaim: 'groups',
		usernameClaim: 'preferred_username',
		emailClaim: 'email',
		usePkce: true,
		scopes: 'openid profile email'
	};
}
