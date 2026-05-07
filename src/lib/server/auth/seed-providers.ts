/**
 * OAuth Provider Seeding from Environment Variables
 * Allows configuring OAuth providers via Helm values at deployment time.
 */

import { logger } from '../logger.js';
import { getDb } from '../db';
import { authProviders, type NewAuthProvider } from '../db/schema';
import { encryptSecret } from './crypto';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

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

/**
 * Seed OAuth providers from environment variables.
 * Providers are read from GYRE_AUTH_PROVIDERS env var (JSON array).
 * Client secrets are read only from
 * GYRE_AUTH_PROVIDER_{SANITIZED_PROVIDER_NAME}_CLIENT_SECRET env vars.
 *
 * @returns Object with created and skipped counts
 */
export async function seedAuthProviders(): Promise<{ created: number; skipped: number }> {
	const providersJson = process.env.GYRE_AUTH_PROVIDERS;

	if (!providersJson || providersJson.trim() === '') {
		return { created: 0, skipped: 0 };
	}

	let providersConfig: unknown[];
	try {
		providersConfig = JSON.parse(providersJson);
		if (!Array.isArray(providersConfig)) {
			throw new Error('GYRE_AUTH_PROVIDERS must be a JSON array');
		}
	} catch (error) {
		logger.error(error, 'Failed to parse GYRE_AUTH_PROVIDERS:');
		throw error instanceof Error ? error : new Error('Failed to parse GYRE_AUTH_PROVIDERS');
	}

	// Pre-validate all providers and prepare DB records before touching the database
	let skipped = 0;
	const validProviders: NewAuthProvider[] = [];
	const secretEnvKeyToProviderName = new Map<string, string>();

	for (let i = 0; i < providersConfig.length; i++) {
		const config = providersConfig[i];
		if (
			typeof config === 'object' &&
			config !== null &&
			Object.prototype.hasOwnProperty.call(config, 'clientSecret')
		) {
			throw new Error(
				`Provider at index ${i} has forbidden inline clientSecret; use GYRE_AUTH_PROVIDER_<SANITIZED_PROVIDER_NAME>_CLIENT_SECRET env var`
			);
		}

		const parseResult = ProviderSeedConfigSchema.safeParse(config);
		if (!parseResult.success) {
			const issues = parseResult.error.issues.map(
				(issue) => `${issue.path.join('.')}: ${issue.message}`
			);
			throw new Error(`Provider at index ${i} failed validation: ${issues.join('; ')}`);
		}
		const validatedConfig: ProviderSeedConfig = parseResult.data;

		// Get client secret from required per-provider env var.
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
			throw new Error(
				`Provider "${validatedConfig.name}" missing required env var ${envSecretKey}`
			);
		}

		// Encrypt client secret
		const clientSecretEncrypted = encryptSecret(clientSecret);

		// Generate provider ID
		const providerId = `provider-${randomBytes(8).toString('hex')}`;

		// Normalize and validate roleMapping
		let roleMapping: string | null = null;
		if (validatedConfig.roleMapping != null) {
			let parsed: unknown;
			if (typeof validatedConfig.roleMapping === 'string') {
				try {
					parsed = JSON.parse(validatedConfig.roleMapping);
				} catch {
					throw new Error(
						`Provider "${validatedConfig.name}" has invalid roleMapping: not valid JSON`
					);
				}
				if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
					throw new Error(
						`Provider "${validatedConfig.name}" has invalid roleMapping: must be a JSON object`
					);
				}
			} else {
				parsed = validatedConfig.roleMapping;
			}
			const rawMapping = parsed as Record<string, unknown>;
			const validated: Record<string, string[]> = {};
			for (const [key, val] of Object.entries(rawMapping)) {
				if (!Array.isArray(val) || !val.every((item) => typeof item === 'string')) {
					throw new Error(
						`Provider "${validatedConfig.name}" has invalid roleMapping: values must be string[] for key "${key}"`
					);
				}
				validated[key] = val;
			}
			roleMapping = JSON.stringify(validated);
		}

		validProviders.push({
			id: providerId,
			name: validatedConfig.name,
			type: validatedConfig.type,
			enabled: validatedConfig.enabled ?? true,
			clientId: validatedConfig.clientId,
			clientSecretEncrypted,
			issuerUrl: validatedConfig.issuerUrl || null,
			authorizationUrl: validatedConfig.authorizationUrl || null,
			tokenUrl: validatedConfig.tokenUrl || null,
			userInfoUrl: validatedConfig.userInfoUrl || null,
			jwksUrl: validatedConfig.jwksUrl || null,
			autoProvision: validatedConfig.autoProvision ?? true,
			defaultRole: validatedConfig.defaultRole || 'viewer',
			roleMapping,
			roleClaim: validatedConfig.roleClaim || 'groups',
			usernameClaim: validatedConfig.usernameClaim || 'preferred_username',
			emailClaim: validatedConfig.emailClaim || 'email',
			usePkce: validatedConfig.usePkce ?? true,
			scopes: validatedConfig.scopes || 'openid profile email',
			createdAt: new Date(),
			updatedAt: new Date()
		});
	}

	if (validProviders.length === 0) {
		return { created: 0, skipped };
	}

	// Insert all valid providers in a single atomic transaction
	const db = await getDb();
	let created = 0;

	try {
		const inserted: boolean[] = [];

		db.transaction((tx) => {
			for (const provider of validProviders) {
				const rows = tx
					.insert(authProviders)
					.values(provider)
					.onConflictDoNothing()
					.returning()
					.all();
				inserted.push(rows.length > 0);
			}
		});

		for (let i = 0; i < validProviders.length; i++) {
			const provider = validProviders[i];
			if (inserted[i]) {
				logger.info(`✓ Created provider "${provider.name}" (${provider.type})`);
				created++;
			} else {
				logger.info(`Provider "${provider.name}" already exists, skipping`);
				skipped++;
			}
		}
	} catch (error) {
		logger.error(error, 'Failed to seed auth providers:');
		throw error;
	}

	return { created, skipped };
}
