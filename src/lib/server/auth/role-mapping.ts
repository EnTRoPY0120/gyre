import { parseRoleMappingInput, type RoleMapping } from '$lib/auth/role-mapping';
import { logger } from '$lib/server/logger.js';

export function parseRoleMappingSafe(value: unknown, providerId: string): RoleMapping | null {
	try {
		return parseRoleMappingInput(value);
	} catch {
		logger.warn({ providerId }, '[auth-providers] Malformed roleMapping JSON');
		return null;
	}
}

export function mapRoleFromGroups(
	groups: string[],
	roleMapping: string | null,
	defaultRole: string
): 'admin' | 'editor' | 'viewer' {
	const normalizedDefault = defaultRole.trim().toLowerCase();
	let safeDefaultRole: 'editor' | 'viewer';
	if (normalizedDefault === 'admin') {
		logger.warn(
			'[Security] SSO provider defaultRole is "admin"; restricting fallback to "editor" to prevent privilege escalation. Assign admin via explicit group mapping.'
		);
		safeDefaultRole = 'editor';
	} else if (normalizedDefault === 'editor') {
		safeDefaultRole = 'editor';
	} else if (normalizedDefault === 'viewer') {
		safeDefaultRole = 'viewer';
	} else {
		logger.warn(
			`[Security] SSO provider defaultRole has unrecognised value "${defaultRole}"; falling back to least-privilege "viewer".`
		);
		safeDefaultRole = 'viewer';
	}

	if (!roleMapping) return safeDefaultRole;

	let mapping: Record<string, string[]>;
	try {
		mapping = JSON.parse(roleMapping);
	} catch (error) {
		logger.error(error, 'Failed to parse role mapping:');
		return safeDefaultRole;
	}

	for (const role of ['admin', 'editor', 'viewer'] as const) {
		if (Array.isArray(mapping[role]) && groups.some((group) => mapping[role].includes(group))) {
			return role;
		}
	}

	return safeDefaultRole;
}
