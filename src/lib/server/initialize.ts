import { getDbSync } from './db/index.js';
import { createDefaultAdminIfNeeded } from './auth.js';
import { isInClusterMode, isLocalMode, getInClusterPaths } from './mode.js';
import { initDatabase } from './db/migrate.js';
import { readFileSync } from 'node:fs';

/**
 * Get current namespace when running in-cluster
 */
function getCurrentNamespace(): string {
	try {
		const { namespacePath } = getInClusterPaths();
		return readFileSync(namespacePath, 'utf-8').trim();
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
	if (isInClusterMode()) {
		console.log('📦 Deployment Mode: In-Cluster');
		console.log('   Using Kubernetes ServiceAccount for API access');
	} else {
		console.log('💻 Deployment Mode: Local');
		console.log('   Using kubeconfig for API access');
	}

	// Initialize database connection and tables
	console.log('\n🗄️  Initializing database...');
	try {
		const db = getDbSync();
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
			if (mode === 'in-cluster') {
				// In-cluster mode: show K8s secret command
				const namespace = getCurrentNamespace();
				console.log('   ⚠️  FIRST TIME SETUP - INITIAL ADMIN PASSWORD:');
				console.log('   ' + '='.repeat(50));
				console.log('   Username: admin');
				console.log('   Password: ' + generatedPassword);
				console.log('   ' + '='.repeat(50));
				console.log('   \n   📋 To retrieve the password later, run:');
				console.log(
					`   kubectl get secret gyre-initial-admin-secret -n ${namespace} -o jsonpath='{.data.password}' | base64 -d`
				);
				console.log('\n   ⚠️  Please change this password after first login!');
				console.log('   After first login, the secret will be marked as consumed.');
			} else {
				// Local mode: show password directly
				console.log('   ⚠️  FIRST TIME SETUP - SAVE THESE CREDENTIALS:');
				console.log('   ' + '='.repeat(50));
				console.log('   Username: admin');
				console.log('   Password: ' + generatedPassword);
				console.log('   ' + '='.repeat(50));
				console.log('   ⚠️  Please change this password after first login!');
			}
		}
		console.log('   ✓ Authentication ready');
	} catch (error) {
		console.error('   ✗ Failed to setup authentication:', error);
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
		initialized: true, // This would be set to true after successful init
		mode: isInClusterMode() ? 'in-cluster' : 'local',
		databaseConnected: true // This would check actual connection
	};
}
