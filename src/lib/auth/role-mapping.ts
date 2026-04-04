export type RoleMapping = Record<string, string[]>;

export const DEFAULT_ROLE_MAPPING_TEMPLATE =
	'{\n  "admin": [],\n  "editor": [],\n  "viewer": []\n}';

export const ROLE_MAPPING_ERROR_MESSAGE =
	'roleMapping must be an object mapping role names to arrays of group strings';

function isRoleMapping(value: unknown): value is RoleMapping {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	return Object.values(value).every(
		(groups) => Array.isArray(groups) && groups.every((group) => typeof group === 'string')
	);
}

export function parseRoleMappingInput(value: unknown): RoleMapping | null {
	if (value == null) {
		return null;
	}

	let parsed = value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return null;
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new Error('Role mapping must be valid JSON');
		}
	}

	if (parsed == null) {
		return null;
	}

	if (!isRoleMapping(parsed)) {
		throw new Error(ROLE_MAPPING_ERROR_MESSAGE);
	}

	return parsed;
}

export function stringifyRoleMappingForForm(
	value: unknown,
	fallback = DEFAULT_ROLE_MAPPING_TEMPLATE
): string {
	if (typeof value === 'string') {
		return value;
	}

	try {
		const parsed = parseRoleMappingInput(value);
		return parsed ? JSON.stringify(parsed, null, 2) : fallback;
	} catch {
		return fallback;
	}
}
