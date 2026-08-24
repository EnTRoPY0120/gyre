import type { AuthProvider } from '$lib/server/db/schema';
import { parseRoleMappingInput } from '$lib/auth/role-mapping';
import { getIssuerUrlValidationError } from './url-security';
import { ProviderType } from './types';

function validateRequiredFields(config: Partial<AuthProvider>): string[] {
	const errors: string[] = [];
	if (!config.name?.trim()) errors.push('Name is required');
	if (!config.type) errors.push('Provider type is required');
	if (!config.clientId?.trim()) errors.push('Client ID is required');
	if (!config.clientSecretEncrypted?.trim()) errors.push('Client Secret is required');
	return errors;
}

function validateIssuer(config: Partial<AuthProvider>): string[] {
	if (config.type !== ProviderType.OIDC && config.type !== ProviderType.OAUTH2_GENERIC) return [];

	const issuerUrl = config.issuerUrl?.trim();
	if (!issuerUrl) return ['Issuer URL is required for this provider'];

	const validationError = getIssuerUrlValidationError(issuerUrl);
	return validationError ? [validationError] : [];
}

function validateScopes(scopes: string | null | undefined): string[] {
	if (!scopes) return [];
	return scopes.split(' ').filter(Boolean).length === 0 ? ['At least one scope is required'] : [];
}

function validateRoleMapping(roleMapping: string | null | undefined): string[] {
	if (!roleMapping) return [];
	try {
		parseRoleMappingInput(roleMapping);
		return [];
	} catch (error) {
		return [error instanceof Error ? error.message : 'Role mapping must be valid JSON'];
	}
}

function validateClaimPath(label: string, value: string | null | undefined): string[] {
	return value && !/^[\w.]+$/.test(value)
		? [`${label} claim path contains invalid characters`]
		: [];
}

/** Validate provider fields without coupling the result to route or form state. */
export function validateProviderConfig(config: Partial<AuthProvider>): {
	valid: boolean;
	errors: string[];
} {
	const errors = [
		...validateRequiredFields(config),
		...validateIssuer(config),
		...validateScopes(config.scopes),
		...validateRoleMapping(config.roleMapping),
		...validateClaimPath('Role', config.roleClaim),
		...validateClaimPath('Username', config.usernameClaim),
		...validateClaimPath('Email', config.emailClaim)
	];

	return { valid: errors.length === 0, errors };
}
