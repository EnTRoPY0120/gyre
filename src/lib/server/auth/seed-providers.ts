/**
 * OAuth Provider Seeding from Environment Variables
 * Allows configuring OAuth providers via Helm values at deployment time.
 */

import { logger } from '../logger.js';
import { getDb } from '../db';
import {
	authProviders,
	parseProviderSeedJson,
	prepareSeedProvider
} from './seed-provider-helpers.js';

/**
 * Seed OAuth providers from environment variables.
 * Providers are read from GYRE_AUTH_PROVIDERS env var (JSON array).
 * Client secrets are read only from
 * GYRE_AUTH_PROVIDER_{SANITIZED_PROVIDER_NAME}_CLIENT_SECRET env vars.
 */
export async function seedAuthProviders(): Promise<{ created: number; skipped: number }> {
	const providersJson = process.env.GYRE_AUTH_PROVIDERS;
	if (!providersJson || providersJson.trim() === '') return { created: 0, skipped: 0 };

	const providersConfig = parseProviderSeedJson(providersJson);
	const secretEnvKeyToProviderName = new Map<string, string>();
	const validProviders = providersConfig.map((config, index) =>
		prepareSeedProvider(config, index, secretEnvKeyToProviderName)
	);

	if (validProviders.length === 0) return { created: 0, skipped: 0 };

	const db = await getDb();
	let created = 0;
	let skipped = 0;

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

		validProviders.forEach((provider, index) => {
			if (inserted[index]) {
				logger.info(`✓ Created provider "${provider.name}" (${provider.type})`);
				created++;
			} else {
				logger.info(`Provider "${provider.name}" already exists, skipping`);
				skipped++;
			}
		});
	} catch (error) {
		logger.error(error, 'Failed to seed auth providers:');
		throw error;
	}

	return { created, skipped };
}
