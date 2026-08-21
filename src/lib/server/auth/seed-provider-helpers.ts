import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { logger } from '../logger.js';
import { authProviders, type NewAuthProvider } from '../db/schema';
import { encryptSecret } from './crypto';

const SUPPORTED_PROVIDER_TYPES = [
	'oidc',
	'oauth2-github',
	'oauth2-google',
	'oauth2-gitlab',
	'oauth2-generic'
] as const;

const ProviderSeedConfigSchema = z
	.object({
		name: z.string().min(1),
		type: z.enum(SUPPORTED_PROVIDER_TYPES),
		enabled: z.boolean().optional(),
		clientId: z.string().min(1),
		issuerUrl: z.string().url().optional().or(z.literal('')).optional(),
		authorizationUrl: z.string().url().optional().or(z.literal('')).optional(),
		tokenUrl: z.string().url().optional().or(z.literal('')).optional(),
		userInfoUrl: z.string().url().optional().or(z.literal('')).optional(),
		jwksUrl: z.string().url().optional().or(z.literal('')).optional(),
		autoProvision: z.boolean().optional(),
		defaultRole: z.enum(['admin', 'editor', 'viewer']).optional(),
		roleMapping: z.union([z.string(), z.record(z.string(), z.array(z.string()))]).optional(),
		roleClaim: z.string().optional(),
		usernameClaim: z.string().optional(),
		emailClaim: z.string().optional(),
		usePkce: z.boolean().optional(),
		scopes: z.string().optional()
	})
	.strict();

type ProviderSeedConfig = z.infer<typeof ProviderSeedConfigSchema>;

export function parseProviderSeedJson(providersJson: string): unknown[] {
	try {
		const parsed: unknown = JSON.parse(providersJson);
		if (!Array.isArray(parsed)) throw new Error('GYRE_AUTH_PROVIDERS must be a JSON array');
		return parsed;
	} catch (error) {
		logger.error(error, 'Failed to parse GYRE_AUTH_PROVIDERS:');
		throw error instanceof Error ? error : new Error('Failed to parse GYRE_AUTH_PROVIDERS');
	}
}

function normalizeRoleMapping(config: ProviderSeedConfig): string | null {
	if (config.roleMapping == null) return null;

	let parsed: unknown = config.roleMapping;
	if (typeof config.roleMapping === 'string') {
		try {
			parsed = JSON.parse(config.roleMapping);
		} catch {
			throw new Error(`Provider "${config.name}" has invalid roleMapping: not valid JSON`);
		}
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error(`Provider "${config.name}" has invalid roleMapping: must be a JSON object`);
	}

	const validated: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
			throw new Error(
				`Provider "${config.name}" has invalid roleMapping: values must be string[] for key "${key}"`
			);
		}
		validated[key] = value;
	}
	return JSON.stringify(validated);
}

export function prepareSeedProvider(
	config: unknown,
	index: number,
	secretEnvKeyToProviderName: Map<string, string>
): NewAuthProvider {
	if (
		typeof config === 'object' &&
		config !== null &&
		Object.prototype.hasOwnProperty.call(config, 'clientSecret')
	) {
		throw new Error(
			`Provider at index ${index} has forbidden inline clientSecret; use GYRE_AUTH_PROVIDER_<SANITIZED_PROVIDER_NAME>_CLIENT_SECRET env var`
		);
	}

	const parseResult = ProviderSeedConfigSchema.safeParse(config);
	if (!parseResult.success) {
		const issues = parseResult.error.issues.map(
			(issue) => `${issue.path.join('.')}: ${issue.message}`
		);
		throw new Error(`Provider at index ${index} failed validation: ${issues.join('; ')}`);
	}
	const validatedConfig: ProviderSeedConfig = parseResult.data;
	const sanitizedName = validatedConfig.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
	const envSecretKey = `GYRE_AUTH_PROVIDER_${sanitizedName}_CLIENT_SECRET`;
	const collidingProviderName = secretEnvKeyToProviderName.get(envSecretKey);
	if (collidingProviderName) {
		throw new Error(
			`Provider "${validatedConfig.name}" env secret key ${envSecretKey} collides with provider "${collidingProviderName}"`
		);
	}
	secretEnvKeyToProviderName.set(envSecretKey, validatedConfig.name);

	const clientSecret = process.env[envSecretKey];
	if (!clientSecret || clientSecret.trim() === '') {
		throw new Error(`Provider "${validatedConfig.name}" missing required env var ${envSecretKey}`);
	}

	const now = new Date();
	return {
		id: `provider-${randomBytes(8).toString('hex')}`,
		name: validatedConfig.name,
		type: validatedConfig.type,
		enabled: validatedConfig.enabled ?? true,
		clientId: validatedConfig.clientId,
		clientSecretEncrypted: encryptSecret(clientSecret),
		issuerUrl: validatedConfig.issuerUrl || null,
		authorizationUrl: validatedConfig.authorizationUrl || null,
		tokenUrl: validatedConfig.tokenUrl || null,
		userInfoUrl: validatedConfig.userInfoUrl || null,
		jwksUrl: validatedConfig.jwksUrl || null,
		autoProvision: validatedConfig.autoProvision ?? true,
		defaultRole: validatedConfig.defaultRole || 'viewer',
		roleMapping: normalizeRoleMapping(validatedConfig),
		roleClaim: validatedConfig.roleClaim || 'groups',
		usernameClaim: validatedConfig.usernameClaim || 'preferred_username',
		emailClaim: validatedConfig.emailClaim || 'email',
		usePkce: validatedConfig.usePkce ?? true,
		scopes: validatedConfig.scopes || 'openid profile email',
		createdAt: now,
		updatedAt: now
	};
}

export { authProviders };
