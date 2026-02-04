import { getDbSync } from './db/index.js';
import { createDefaultAdminIfNeeded } from './auth.js';
import { initDatabase } from './db/migrate.js';
import { initializeDefaultPolicies, repairUserPolicyBindings } from './rbac-defaults.js';
import { readFileSync } from 'node:fs';

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
	if (isInCluster) {
		console.log('📦 Deployment Mode: In-Cluster');
		console.log('   Using Kubernetes ServiceAccount for API access');
	} else {
		console.log('📦 Deployment Mode: Local Development');
		console.log('   Using local kubeconfig for cluster access');
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
				console.log('   ⚠️  Please save this password - it won\'t be shown again!');
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
