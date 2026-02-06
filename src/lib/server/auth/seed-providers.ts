/**
 * OAuth Provider Seeding from Environment Variables
 * Allows configuring OAuth providers via Helm values at deployment time.
 */

import { getDb } from '../db';
import { authProviders, type NewAuthProvider } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encryptSecret } from './crypto';
import { randomBytes } from 'node:crypto';

interface ProviderSeedConfig {
	name: string;
	type: 'oidc' | 'oauth2-github' | 'oauth2-google' | 'oauth2-gitlab' | 'oauth2-generic';
	enabled?: boolean;
	clientId: string;
	clientSecret: string;
	issuerUrl?: string;
	authorizationUrl?: string;
	tokenUrl?: string;
	userInfoUrl?: string;
	jwksUrl?: string;
	autoProvision?: boolean;
	defaultRole?: 'admin' | 'editor' | 'viewer';
	roleMapping?: string;
	roleClaim?: string;
	usernameClaim?: string;
	emailClaim?: string;
	usePkce?: boolean;
	scopes?: string;
}

/**
 * Seed OAuth providers from environment variables.
 * Providers are read from GYRE_AUTH_PROVIDERS env var (JSON array).
 * Client secrets can be overridden from GYRE_AUTH_PROVIDER_{index}_CLIENT_SECRET env vars.
 *
 * @returns Object with created and skipped counts
 */
export async function seedAuthProviders(): Promise<{ created: number; skipped: number }> {
	const providersJson = process.env.GYRE_AUTH_PROVIDERS;

	if (!providersJson || providersJson.trim() === '') {
		return { created: 0, skipped: 0 };
	}

	let providersConfig: ProviderSeedConfig[];
	try {
		providersConfig = JSON.parse(providersJson);
		if (!Array.isArray(providersConfig)) {
			console.error('GYRE_AUTH_PROVIDERS must be a JSON array');
			return { created: 0, skipped: 0 };
		}
	} catch (error) {
		console.error('Failed to parse GYRE_AUTH_PROVIDERS:', error);
		return { created: 0, skipped: 0 };
	}

	const db = await getDb();
	let created = 0;
	let skipped = 0;

	for (let i = 0; i < providersConfig.length; i++) {
		const config = providersConfig[i];

		// Validate required fields
		if (!config.name || !config.type || !config.clientId) {
			console.warn(
				`Skipping provider at index ${i}: missing required fields (name, type, clientId)`
			);
			skipped++;
			continue;
		}

		// Check if provider with same name already exists
		const existing = await db.query.authProviders.findFirst({
			where: eq(authProviders.name, config.name)
		});

		if (existing) {
			console.log(`Provider "${config.name}" already exists, skipping`);
			skipped++;
			continue;
		}

		// Get client secret (from env var override or config)
		const envSecretKey = `GYRE_AUTH_PROVIDER_${i}_CLIENT_SECRET`;
		const clientSecret = process.env[envSecretKey] || config.clientSecret;

		if (!clientSecret) {
			console.warn(`Skipping provider "${config.name}": no client secret provided`);
			skipped++;
			continue;
		}

		try {
			// Encrypt client secret
			const clientSecretEncrypted = encryptSecret(clientSecret);

			// Generate provider ID
			const providerId = `provider-${randomBytes(8).toString('hex')}`;

			// Create provider
			const newProvider: NewAuthProvider = {
				id: providerId,
				name: config.name,
				type: config.type,
				enabled: config.enabled ?? true,
				clientId: config.clientId,
				clientSecretEncrypted,
				issuerUrl: config.issuerUrl || null,
				authorizationUrl: config.authorizationUrl || null,
				tokenUrl: config.tokenUrl || null,
				userInfoUrl: config.userInfoUrl || null,
				jwksUrl: config.jwksUrl || null,
				autoProvision: config.autoProvision ?? true,
				defaultRole: config.defaultRole || 'viewer',
				roleMapping: config.roleMapping || null,
				roleClaim: config.roleClaim || 'groups',
				usernameClaim: config.usernameClaim || 'preferred_username',
				emailClaim: config.emailClaim || 'email',
				usePkce: config.usePkce ?? true,
				scopes: config.scopes || 'openid profile email',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await db.insert(authProviders).values(newProvider);
			console.log(`✓ Created provider "${config.name}" (${config.type})`);
			created++;
		} catch (error) {
			console.error(`Failed to create provider "${config.name}":`, error);
			skipped++;
		}
	}

	return { created, skipped };
}
