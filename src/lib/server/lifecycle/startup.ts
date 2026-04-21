import { logger } from '../logger.js';
import { getDbSync } from '../db/index.js';
import { createDefaultAdminIfNeeded, setSetupTokenFile } from '../auth.js';
import { initDatabase } from '../db/migrate.js';
import { initializeDefaultPolicies, repairUserPolicyBindings } from '../rbac-defaults.js';
import { quarantineInvalidNamespacePatterns } from '../rbac.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateKubeconfigs } from '../clusters/migration.js';
import { seedAuthSettings } from '../settings.js';
import { seedAuthProviders } from '../auth/seed-providers.js';
import { scheduleCleanup } from '../kubernetes/flux/reconciliation-cleanup.js';
import { scheduleSessionCleanup } from '../auth/session-cleanup.js';
import { scheduleAuditLogCleanup } from '../audit.js';
import { validateStartupSecurity } from './security-validation.js';

const IN_CLUSTER_NAMESPACE_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

/**
 * Get current namespace from in-cluster ServiceAccount
 */
function getCurrentNamespace(): string {
	try {
		return readFileSync(IN_CLUSTER_NAMESPACE_PATH, 'utf-8').trim();
	} catch {
		return 'default';
	}
}

/**
 * Initialize Gyre on startup
 * - Creates database tables if they don't exist
 * - Creates default admin user if no users exist
 * - Logs deployment mode
 */
export async function initializeGyre(): Promise<void> {
	logger.info('='.repeat(60));
	logger.info('  Gyre - FluxCD Dashboard');
	logger.info('='.repeat(60));

	// Log deployment mode
	const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
	const isProd = process.env.NODE_ENV === 'production';

	if (isInCluster) {
		logger.info('📦 Deployment Mode: In-Cluster');
		logger.info('   Using Kubernetes ServiceAccount for API access');
	} else {
		logger.info('📦 Deployment Mode: Local Development');
		logger.info('   Using local kubeconfig for cluster access');
	}

	validateStartupSecurity(isProd);

	// Initialize database connection and tables
	logger.info('\n🗄️  Initializing database...');
	try {
		getDbSync();
		initDatabase(); // Create tables if they don't exist
		logger.info('   ✓ Database connection established');
	} catch (error) {
		logger.error(error, '   ✗ Failed to connect to database');
		throw error;
	}

	// Migrate kubeconfigs to new encryption format if needed (must run after DB is initialized)
	try {
		const { migrated, failed } = await migrateKubeconfigs();
		if (migrated > 0) {
			logger.info(`   ✓ Migrated ${migrated} cluster(s) to new encryption format`);
		}
		if (failed > 0) {
			logger.warn(`   ⚠️  Failed to migrate ${failed} cluster(s) — check logs above for details`);
		}
	} catch (error) {
		logger.error(error, '   ✗ Failed to migrate kubeconfigs');
		// Don't throw here, as the app can still function with old encryption if migration fails
	}

	// Create default admin if needed
	logger.info('\n👤 Setting up authentication...');
	try {
		const { password: setupToken, mode } = await createDefaultAdminIfNeeded();

		if (setupToken) {
			logger.info('   ⚠️  FIRST TIME SETUP - INITIAL ADMIN PASSWORD:');
			logger.info('   ' + '='.repeat(50));
			logger.info('   Username: admin');

			if (mode === 'in-cluster') {
				// In-cluster mode: show K8s secret command
				const namespace = getCurrentNamespace();
				logger.info('   Password has been securely stored in a Kubernetes secret.');
				logger.info('   ' + '='.repeat(50));
				logger.info('   \n   📋 To retrieve the password, run:');
				logger.info(
					`   kubectl get secret gyre-initial-admin-secret -n ${namespace} -o jsonpath='{.data.password}' | base64 -d`
				);
				logger.info('\n   ⚠️  Please change this password after first login!');
				logger.info('   After first login, the secret will be marked as consumed.');
			} else {
				// Local development mode: write token to a restricted temp file to avoid
				// plaintext credentials appearing in container or terminal logs.
				const tokenFile = join(tmpdir(), `gyre-setup-token-${Date.now()}.txt`);
				try {
					writeFileSync(tokenFile, setupToken, { mode: 0o600, flag: 'wx' });
				} catch (writeErr) {
					logger.error(writeErr, '   ✗ Failed to write setup token file');
					throw writeErr;
				}
				// Register the file path so auth.ts can remove it after first login.
				setSetupTokenFile(tokenFile);
				logger.warn('   ⚠️  WARNING: Container or terminal logs may capture plaintext passwords.');
				logger.warn('   The setup token has been written to a restricted file (mode 0600).');
				logger.info(`   Token file: ${tokenFile}`);
				logger.info('   ' + '='.repeat(50));
				logger.info('\n   💡 For local development, you can also set ADMIN_PASSWORD env var');
				logger.info("   ⚠️  Please read the token from the file above - it won't be shown again!");
			}
		}
		logger.info('   ✓ Authentication ready');
	} catch (error) {
		logger.error(error, '   ✗ Failed to setup authentication');
		throw error;
	}

	// Initialize default RBAC policies
	logger.info('\n🔐 Setting up RBAC policies...');
	try {
		await initializeDefaultPolicies();
		const repairedCount = await repairUserPolicyBindings();
		if (repairedCount > 0) {
			logger.info(`   ✓ Repaired RBAC bindings for ${repairedCount} existing user(s)`);
		}
		const quarantinedCount = await quarantineInvalidNamespacePatterns();
		if (quarantinedCount > 0) {
			logger.warn(
				`   ⚠ Quarantined ${quarantinedCount} RBAC policy/policies with invalid namespacePattern`
			);
		}
		logger.info('   ✓ RBAC policies ready');
	} catch (error) {
		logger.error(error, '   ✗ Failed to setup RBAC policies');
		throw error;
	}

	// Seed auth settings and providers from environment
	logger.info('\n🔑 Setting up authentication settings...');
	try {
		await seedAuthSettings();
		const seedResult = await seedAuthProviders();
		if (seedResult.created > 0) {
			logger.info(`   ✓ Seeded ${seedResult.created} auth provider(s)`);
		}
		if (seedResult.skipped > 0) {
			logger.info(
				`   ℹ Skipped ${seedResult.skipped} provider(s) (existing or invalid/missing secrets)`
			);
		}
		logger.info('   ✓ Authentication settings ready');
	} catch (error) {
		logger.error(error, '   ✗ Failed to seed auth settings');
		// Don't throw - app can still work without seeded providers
	}

	// Schedule reconciliation history cleanup
	logger.info('\n🧹 Setting up data cleanup...');
	try {
		scheduleCleanup();
		scheduleAuditLogCleanup();
		scheduleSessionCleanup();
		logger.info('   ✓ Cleanup schedulers initialized');
	} catch (error) {
		logger.error(error, '   ✗ Failed to schedule cleanup');
		// Don't throw - app can still work without cleanup
	}

	logger.info('\n' + '='.repeat(60));
	logger.info('  Gyre is ready!');
	logger.info('='.repeat(60) + '\n');
}
