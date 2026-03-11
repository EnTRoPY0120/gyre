import { getDbSync, closeDb } from './db/index.js';
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
import { scheduleCleanup, stopCleanup } from './kubernetes/flux/reconciliation-cleanup.js';
import { scheduleSessionCleanup, stopSessionCleanup } from './auth/session-cleanup.js';
import { scheduleAuditLogCleanup, stopAuditLogCleanup } from './audit.js';
import { closeAllEventStreams, setEventBusShuttingDown } from './events.js';

const IN_CLUSTER_NAMESPACE_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

let isShuttingDown = false;

function safeCloseDb(context: string = 'shutdown') {
	try {
		closeDb();
		console.log(`   ✓ Database connection closed (${context})`);
	} catch (error) {
		console.error(`   ✗ Error closing database during ${context}:`, error);
	}
}

/**
 * Shutdown Gyre gracefully, awaiting any in-flight cleanup work before exiting.
 */
export async function shutdownGyre(): Promise<void> {
	console.log('\n🛑 Shutting down Gyre background tasks...');
	// Mark event bus as shutting down early to reject new subscriptions before await steps
	setEventBusShuttingDown();
	try {
		const results = await Promise.allSettled([stopCleanup(), stopAuditLogCleanup()]);
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const task = index === 0 ? 'stopCleanup' : 'stopAuditLogCleanup';
				console.error(`   ✗ Error during ${task}:`, result.reason);
			}
		});
		stopSessionCleanup();
		await closeAllEventStreams();
		console.log('   ✓ Cleanup schedulers and SSE connections stopped');
	} catch (error) {
		console.error('   ✗ Error during shutdown:', error);
	}
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
	let forceExit: NodeJS.Timeout | null = null;
	let httpDrainTimeout: NodeJS.Timeout | null = null;

	const handleSignal = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

		// Force-exit after 15s if graceful shutdown hangs
		// (K8s terminationGracePeriodSeconds defaults to 30s, so we want to exit before SIGKILL)
		forceExit = setTimeout(() => {
			console.error('   ✗ Graceful shutdown took too long, forcing exit (HTTP drain timed out)');
			console.error('   ✗ Force-exiting: any in-flight DB requests will fail');
			safeCloseDb('force-exit');
			process.exit(1);
		}, 15_000);
		forceExit.unref();

		await shutdownGyre();

		if (forceExit) {
			clearTimeout(forceExit);
			forceExit = null;
		}

		// In development (vite), sveltekit:shutdown is not emitted.
		// adapter-node only emits sveltekit:shutdown in production builds.
		// We exit immediately after cleanup.
		if (process.env.NODE_ENV !== 'production') {
			safeCloseDb('development shutdown');
			process.exit(0);
		} else {
			// Production path: adapter-node will emit sveltekit:shutdown when HTTP drain completes.
			// Guard against the event never firing.
			httpDrainTimeout = setTimeout(() => {
				console.error('   ✗ sveltekit:shutdown not received within 10s, forcing exit');
				safeCloseDb('drain timeout');
				process.exit(1);
			}, 10_000);
			httpDrainTimeout.unref();
		}
	};

	process.on('SIGTERM', () =>
		handleSignal('SIGTERM').catch((err) => console.error('Signal handler error:', err))
	);
	process.on('SIGINT', () =>
		handleSignal('SIGINT').catch((err) => console.error('Signal handler error:', err))
	);

	process.on('sveltekit:shutdown', async () => {
		console.log('   ✓ HTTP server stopped');
		if (forceExit) clearTimeout(forceExit);
		if (httpDrainTimeout) clearTimeout(httpDrainTimeout);

		// If sveltekit:shutdown fires without prior signal (adapter handled it),
		// run shutdown now to ensure cleanup completes
		if (!isShuttingDown) {
			isShuttingDown = true;
			await shutdownGyre();
		}

		safeCloseDb('graceful shutdown');
		console.log('👋 Gyre shutdown complete.');
		process.exit(0);
	});
}

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
		const { password: setupToken, mode } = await createDefaultAdminIfNeeded();

		if (setupToken) {
			console.log('   ⚠️  FIRST TIME SETUP - INITIAL ADMIN PASSWORD:');
			console.log('   ' + '='.repeat(50));
			console.log('   Username: admin');

			if (mode === 'in-cluster') {
				// In-cluster mode: show K8s secret command
				const namespace = getCurrentNamespace();
				console.log('   Password has been securely stored in a Kubernetes secret.');
				console.log('   ' + '='.repeat(50));
				console.log('   \n   📋 To retrieve the password, run:');
				console.log(
					`   kubectl get secret gyre-initial-admin-secret -n ${namespace} -o jsonpath='{.data.password}' | base64 -d`
				);
				console.log('\n   ⚠️  Please change this password after first login!');
				console.log('   After first login, the secret will be marked as consumed.');
			} else {
				// Local development mode
				console.log('   Password: ' + setupToken); // codeql[js/clear-text-logging]
				console.log('   ' + '='.repeat(50));
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
	console.log('\n🧹 Setting up data cleanup...');
	try {
		scheduleCleanup();
		scheduleAuditLogCleanup();
		console.log('   ✓ Cleanup schedulers initialized');
	} catch (error) {
		console.error('   ✗ Failed to schedule cleanup:', error);
		// Don't throw - app can still work without cleanup
	}

	console.log('\n' + '='.repeat(60));
	console.log('  Gyre is ready!');
	console.log('='.repeat(60) + '\n');
}

// Initialize session cleanup immediately at startup
try {
	scheduleSessionCleanup();
} catch (error) {
	console.error('[SessionCleanup] Failed to initialize scheduler:', error);
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
