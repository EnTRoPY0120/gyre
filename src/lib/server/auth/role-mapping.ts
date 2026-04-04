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
