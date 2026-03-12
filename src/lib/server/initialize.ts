import { logger } from './logger.js';
import { getDbSync, closeDb } from './db/index.js';
import { createDefaultAdminIfNeeded } from './auth.js';
import { initDatabase } from './db/migrate.js';
import { initializeDefaultPolicies, repairUserPolicyBindings } from './rbac-defaults.js';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
let activeShutdownPromise: Promise<void> | null = null;

function safeCloseDb(context: string = 'shutdown') {
	try {
		closeDb();
		logger.info(`   ✓ Database connection closed (${context})`);
	} catch (error) {
		logger.error(error, `   ✗ Error closing database during ${context}:`);
	}
}

/**
 * Shutdown Gyre gracefully, awaiting any in-flight cleanup work before exiting.
 */
export async function shutdownGyre(): Promise<void> {
	logger.info('\n🛑 Shutting down Gyre background tasks...');
	// Mark event bus as shutting down early to reject new subscriptions before await steps
	setEventBusShuttingDown();
	try {
		const results = await Promise.allSettled([stopCleanup(), stopAuditLogCleanup()]);
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const task = index === 0 ? 'stopCleanup' : 'stopAuditLogCleanup';
				logger.error(result.reason, `   ✗ Error during ${task}:`);
			}
		});
		try {
			stopSessionCleanup();
		} catch (error) {
			logger.error(error, '   ✗ Error during stopSessionCleanup:');
		}
		await closeAllEventStreams();
		logger.info('   ✓ Cleanup schedulers and SSE connections stopped');
	} catch (error) {
		logger.error(error, '   ✗ Error during shutdown:');
	}
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
	let forceExit: NodeJS.Timeout | null = null;
	let httpDrainTimeout: NodeJS.Timeout | null = null;

	const handleSignal = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		logger.info(`\n🛑 Received ${signal}, starting graceful shutdown...`);

		const isProd = process.env.NODE_ENV === 'production';

		// Force-exit after 15s if graceful shutdown hangs (5s in dev)
		// (K8s terminationGracePeriodSeconds defaults to 30s, so we want to exit before SIGKILL)
		// NOTE: Lowering terminationGracePeriodSeconds below 30s in K8s manifests would break this timing.
		forceExit = setTimeout(
			() => {
				logger.error('   ✗ Graceful shutdown took too long, forcing exit (HTTP drain timed out)');
				logger.error('   ✗ Force-exiting: any in-flight DB requests will fail');
				safeCloseDb('force-exit');
				process.exit(1);
			},
			isProd ? 15_000 : 5_000
		);
		forceExit.unref();

		activeShutdownPromise = shutdownGyre();
		await activeShutdownPromise;

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
				logger.error('   ✗ sveltekit:shutdown not received within 10s, forcing exit');
				safeCloseDb('drain timeout');
				process.exit(1);
			}, 10_000);
			httpDrainTimeout.unref();
		}
	};

	process.on('SIGTERM', () =>
		handleSignal('SIGTERM').catch((err) => logger.error(err, 'Signal handler error:'))
	);
	process.on('SIGINT', () =>
		handleSignal('SIGINT').catch((err) => logger.error(err, 'Signal handler error:'))
	);

	process.on('sveltekit:shutdown', async () => {
		logger.info('   ✓ HTTP server stopped');
		if (forceExit) clearTimeout(forceExit);
		if (httpDrainTimeout) clearTimeout(httpDrainTimeout);

		// If sveltekit:shutdown fires without prior signal (adapter handled it),
		// run shutdown now to ensure cleanup completes.
		// If a signal handler already started shutdown, await the same promise so
		// safeCloseDb only runs after that work is fully done (no race).
		if (!isShuttingDown) {
			isShuttingDown = true;
			activeShutdownPromise = shutdownGyre();
			await activeShutdownPromise;
		} else if (activeShutdownPromise) {
			await activeShutdownPromise;
		}

		safeCloseDb('graceful shutdown');
		logger.info('👋 Gyre shutdown complete.');
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

	// Encryption checks
	logger.info('\n🔐 Validating encryption...');
	try {
		// Test Auth Encryption
		if (!testAuthEncryption()) {
			throw new Error('Authentication encryption test failed!');
		}
		if (isUsingDevAuthKey()) {
			if (isProd) {
				throw new Error('AUTH_ENCRYPTION_KEY must be set in production!');
			}
			logger.warn('   ⚠️  Using development key for AUTH_ENCRYPTION_KEY');
		}

		// Test Cluster Encryption
		if (!testClusterEncryption()) {
			throw new Error('Cluster kubeconfig encryption test failed!');
		}
		if (isUsingDevClusterKey()) {
			if (isProd) {
				throw new Error('GYRE_ENCRYPTION_KEY must be set in production!');
			}
			logger.warn('   ⚠️  Using development key for GYRE_ENCRYPTION_KEY');
		}

		logger.info('   ✓ Encryption validation passed');
	} catch (error) {
		logger.error(error, '   ✗ Encryption validation failed');
		throw error;
	}

	// Migrate kubeconfigs to new encryption format if needed
	try {
		const migratedCount = await migrateKubeconfigs();
		if (migratedCount > 0) {
			logger.info(`   ✓ Migrated ${migratedCount} cluster(s) to new encryption format`);
		}
	} catch (error) {
		logger.error(error, '   ✗ Failed to migrate kubeconfigs');
		// Don't throw here, as the app can still function with old encryption if migration fails
	}

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
				writeFileSync(tokenFile, setupToken, { mode: 0o600 });
				// Remove the file when the server process exits so credentials do not
				// persist on disk after the server has stopped.
				process.once('exit', () => {
					try {
						unlinkSync(tokenFile);
					} catch {
						// Ignore errors during cleanup
					}
				});
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
		logger.info('   ✓ Cleanup schedulers initialized');
	} catch (error) {
		logger.error(error, '   ✗ Failed to schedule cleanup');
		// Don't throw - app can still work without cleanup
	}

	logger.info('\n' + '='.repeat(60));
	logger.info('  Gyre is ready!');
	logger.info('='.repeat(60) + '\n');
}

// Initialize session cleanup immediately at startup
try {
	scheduleSessionCleanup();
} catch (error) {
	logger.error(error, '[SessionCleanup] Failed to initialize scheduler');
}
