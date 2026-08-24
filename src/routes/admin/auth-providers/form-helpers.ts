import type { AuthProviderFormData } from '$lib/components/admin/auth-provider';
import {
	DEFAULT_ROLE_MAPPING_TEMPLATE,
	parseRoleMappingInput,
	type RoleMapping
} from '$lib/auth/role-mapping';

export function normalizeRoleMappingForSave(value: string): RoleMapping | null {
	const trimmed = value.trim();
	if (!trimmed || trimmed === DEFAULT_ROLE_MAPPING_TEMPLATE.trim()) return null;

	try {
		const parsed = parseRoleMappingInput(trimmed);
		if (!parsed || Object.values(parsed).every((groups) => groups.length === 0)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function buildAuthProviderUpdates(
	formData: AuthProviderFormData,
	roleMapping: Record<string, string[]> | null
): Record<string, unknown> {
	const updates: Record<string, unknown> = {
		name: formData.name,
		type: formData.type,
		enabled: formData.enabled,
		clientId: formData.clientId,
		issuerUrl: formData.issuerUrl,
		autoProvision: formData.autoProvision,
		defaultRole: formData.defaultRole,
		roleMapping,
		roleClaim: formData.roleClaim,
		usernameClaim: formData.usernameClaim,
		emailClaim: formData.emailClaim,
		usePkce: formData.usePkce,
		scopes: formData.scopes
	};

	// An empty edit-form secret means “keep the current secret”, never clear it.
	if (formData.clientSecret) updates.clientSecret = formData.clientSecret;

	return updates;
}
