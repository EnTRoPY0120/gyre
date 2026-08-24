import { parseRoleMappingInput, type RoleMapping } from '$lib/auth/role-mapping';
import { logger } from '$lib/server/logger.js';

type SsoRole = 'admin' | 'editor' | 'viewer';
const ROLE_PRIORITY: SsoRole[] = ['admin', 'editor', 'viewer'];

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
): SsoRole {
	const safeDefaultRole = getSafeDefaultRole(defaultRole);
	if (!roleMapping) return safeDefaultRole;

	const mapping = parseRoleMappingForGroups(roleMapping);
	return findMappedRole(groups, mapping) ?? safeDefaultRole;
}

function getSafeDefaultRole(defaultRole: string): Exclude<SsoRole, 'admin'> {
	const normalizedDefault = defaultRole.trim().toLowerCase();
	if (normalizedDefault === 'admin') {
		logger.warn(
			'[Security] SSO provider defaultRole is "admin"; restricting fallback to "editor" to prevent privilege escalation. Assign admin via explicit group mapping.'
		);
		return 'editor';
	}
	if (normalizedDefault === 'editor') return 'editor';
	if (normalizedDefault === 'viewer') return 'viewer';

	logger.warn(
		`[Security] SSO provider defaultRole has unrecognised value "${defaultRole}"; falling back to least-privilege "viewer".`
	);
	return 'viewer';
}

function parseRoleMappingForGroups(roleMapping: string): RoleMapping | null {
	try {
		return parseRoleMappingInput(roleMapping);
	} catch (error) {
		logger.error(error, 'Failed to parse role mapping:');
		return null;
	}
}

function findMappedRole(groups: string[], mapping: RoleMapping | null): SsoRole | null {
	if (!mapping) return null;

	for (const role of ROLE_PRIORITY) {
		if (mapping[role]?.some((mappedGroup) => groups.includes(mappedGroup))) {
			return role;
		}
	}

	return null;
}
