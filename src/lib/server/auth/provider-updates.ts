import { error } from '@sveltejs/kit';
import { parseRoleMappingInput } from '$lib/auth/role-mapping';
import { encryptSecret } from './crypto';

const DIRECT_UPDATE_FIELDS = [
	'name',
	'type',
	'enabled',
	'clientId',
	'issuerUrl',
	'authorizationUrl',
	'tokenUrl',
	'userInfoUrl',
	'jwksUrl',
	'autoProvision',
	'defaultRole',
	'roleClaim',
	'usernameClaim',
	'emailClaim',
	'usePkce',
	'scopes'
] as const;

export function buildAuthProviderUpdate(body: Record<string, unknown>): {
	appliedUpdate: Record<string, unknown>;
	changedKeys: string[];
} {
	const appliedUpdate: Record<string, unknown> = {};
	for (const field of DIRECT_UPDATE_FIELDS) {
		if (body[field] !== undefined) appliedUpdate[field] = body[field];
	}

	if (body.roleMapping !== undefined) {
		try {
			const parsedRoleMapping = parseRoleMappingInput(body.roleMapping);
			appliedUpdate.roleMapping = parsedRoleMapping ? JSON.stringify(parsedRoleMapping) : null;
		} catch (parseError) {
			throw error(400, {
				message:
					parseError instanceof Error
						? parseError.message
						: 'roleMapping must be an object mapping role names to arrays of group strings'
			});
		}
	}

	if (typeof body.clientSecret === 'string' && body.clientSecret.trim().length > 0) {
		appliedUpdate.clientSecretEncrypted = encryptSecret(body.clientSecret);
	}

	return {
		appliedUpdate,
		changedKeys: Object.keys(appliedUpdate).filter((key) => key !== 'clientSecretEncrypted')
	};
}
