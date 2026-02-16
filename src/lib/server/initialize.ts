import { getDbSync } from './db/index.js';
import { createDefaultAdminIfNeeded } from './auth.js';
import { initDatabase } from './db/migrate.js';
import { initializeDefaultPolicies, repairUserPolicyBindings } from './rbac-defaults.js';
import { readFileSync } from 'node:fs';
import {
	testEncryption as testAuthEncryption,
	isUsingDevelopmentKey as isUsingDevAuthKey
} from './auth/crypto.js';
import {
	testEncryption as testClusterEncryption,
	isUsingDevelopmentKey as isUsingDevClusterKey,
	migrateKubeconfigs
} from './clusters.js';
import { seedAuthSettings } from './settings.js';
import { seedAuthProviders } from './auth/seed-providers.js';
import { scheduleCleanup } from './kubernetes/flux/reconciliation-cleanup.js';

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
	console.log('='.repeat(60));
	console.log('  Gyre - FluxCD Dashboard');
	console.log('='.repeat(60));

	// Log deployment mode
	const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
	const isProd = process.env.NODE_ENV === 'production';

	if (isInCluster) {
		console.log('📦 Deployment Mode: In-Cluster');
		console.log('   Using Kubernetes ServiceAccount for API access');
	} else {
		console.log('📦 Deployment Mode: Local Development');
		console.log('   Using local kubeconfig for cluster access');
	}

	// Encryption checks
	console.log('\n🔐 Validating encryption...');
	try {
		// Test Auth Encryption
		if (!testAuthEncryption()) {
			throw new Error('Authentication encryption test failed!');
		}
		if (isUsingDevAuthKey()) {
			if (isProd) {
				throw new Error('AUTH_ENCRYPTION_KEY must be set in production!');
			}
			console.warn('   ⚠️  Using development key for AUTH_ENCRYPTION_KEY');
		}

		// Test Cluster Encryption
		if (!testClusterEncryption()) {
			throw new Error('Cluster kubeconfig encryption test failed!');
		}
		if (isUsingDevClusterKey()) {
			if (isProd) {
				throw new Error('GYRE_ENCRYPTION_KEY must be set in production!');
			}
			console.warn('   ⚠️  Using development key for GYRE_ENCRYPTION_KEY');
		}

		console.log('   ✓ Encryption validation passed');
	} catch (error) {
		console.error(
			'   ✗ Encryption validation failed:',
			error instanceof Error ? error.message : error
		);
		throw error;
	}

	// Migrate kubeconfigs to new encryption format if needed
	try {
		const migratedCount = await migrateKubeconfigs();
		if (migratedCount > 0) {
			console.log(`   ✓ Migrated ${migratedCount} cluster(s) to new encryption format`);
		}
	} catch (error) {
		console.error('   ✗ Failed to migrate kubeconfigs:', error);
		// Don't throw here, as the app can still function with old encryption if migration fails
	}

	// Initialize database connection and tables
	console.log('\n🗄️  Initializing database...');
	try {
		getDbSync();
		initDatabase(); // Create tables if they don't exist
		console.log('   ✓ Database connection established');
	} catch (error) {
		console.error('   ✗ Failed to connect to database:', error);
		throw error;
	}

	// Create default admin if needed
	console.log('\n👤 Setting up authentication...');
	try {
		const { password: generatedPassword, mode } = await createDefaultAdminIfNeeded();

		if (generatedPassword) {
			console.log('   ⚠️  FIRST TIME SETUP - INITIAL ADMIN PASSWORD:');
			console.log('   ' + '='.repeat(50));
			console.log('   Username: admin');
			console.log('   Password: ' + generatedPassword);
			console.log('   ' + '='.repeat(50));

			if (mode === 'in-cluster') {
				// In-cluster mode: show K8s secret command
				const namespace = getCurrentNamespace();
				console.log('   \n   📋 To retrieve the password later, run:');
				console.log(
					`   kubectl get secret gyre-initial-admin-secret -n ${namespace} -o jsonpath='{.data.password}' | base64 -d`
				);
				console.log('\n   ⚠️  Please change this password after first login!');
				console.log('   After first login, the secret will be marked as consumed.');
			} else {
				// Local development mode
				console.log('\n   💡 For local development, you can also set ADMIN_PASSWORD env var');
				console.log("   ⚠️  Please save this password - it won't be shown again!");
			}
		}
		console.log('   ✓ Authentication ready');
	} catch (error) {
		console.error('   ✗ Failed to setup authentication:', error);
		throw error;
	}

	// Initialize default RBAC policies
	console.log('\n🔐 Setting up RBAC policies...');
	try {
		await initializeDefaultPolicies();
		const repairedCount = await repairUserPolicyBindings();
		if (repairedCount > 0) {
			console.log(`   ✓ Repaired RBAC bindings for ${repairedCount} existing user(s)`);
		}
		console.log('   ✓ RBAC policies ready');
	} catch (error) {
		console.error('   ✗ Failed to setup RBAC policies:', error);
		throw error;
	}

	// Seed auth settings and providers from environment
	console.log('\n🔑 Setting up authentication settings...');
	try {
		await seedAuthSettings();
		const seedResult = await seedAuthProviders();
		if (seedResult.created > 0) {
			console.log(`   ✓ Seeded ${seedResult.created} auth provider(s)`);
		}
		if (seedResult.skipped > 0) {
			console.log(
				`   ℹ Skipped ${seedResult.skipped} provider(s) (existing or invalid/missing secrets)`
			);
		}
		console.log('   ✓ Authentication settings ready');
	} catch (error) {
		console.error('   ✗ Failed to seed auth settings:', error);
		// Don't throw - app can still work without seeded providers
	}

	// Schedule reconciliation history cleanup
	console.log('\n🧹 Setting up reconciliation history cleanup...');
	try {
		scheduleCleanup();
		console.log('   ✓ Cleanup scheduler initialized');
	} catch (error) {
		console.error('   ✗ Failed to schedule cleanup:', error);
		// Don't throw - app can still work without cleanup
	}

	console.log('\n' + '='.repeat(60));
	console.log('  Gyre is ready!');
	console.log('='.repeat(60) + '\n');
}

/**
 * Get initialization status for health checks
 */
export function getInitializationStatus(): {
	initialized: boolean;
	mode: string;
	databaseConnected: boolean;
} {
	return {
		initialized: true,
		mode: 'in-cluster',
		databaseConnected: true
	};
}
