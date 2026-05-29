import { logger } from '../logger.js';
import { testAuthEncryption, isUsingDevelopmentAuthKey } from '../auth/crypto.js';
import { testClusterEncryption, isUsingDevelopmentClusterKey } from '../clusters/encryption.js';
import { validateProductionSecurityConfig } from '../security-config.js';

export function validateStartupSecurity(isProd: boolean): void {
	// Encryption checks
	logger.info('Validating encryption');
	try {
		// Test Auth Encryption
		if (!testAuthEncryption()) {
			throw new Error('AUTH encryption check failed');
		}
		if (isUsingDevelopmentAuthKey()) {
			if (isProd) {
				throw new Error('AUTH_ENCRYPTION_KEY must be set in production');
			}
			logger.warn('Using development key for AUTH_ENCRYPTION_KEY');
		}

		// Test Cluster Encryption
		if (!testClusterEncryption()) {
			throw new Error('Cluster kubeconfig encryption check failed');
		}
		if (isUsingDevelopmentClusterKey()) {
			if (isProd) {
				throw new Error('GYRE_ENCRYPTION_KEY must be set in production');
			}
			logger.warn('Using development key for GYRE_ENCRYPTION_KEY');
		}

		logger.info('Encryption validation passed');
	} catch (error) {
		logger.error(error, 'Encryption validation failed');
		throw error;
	}

	if (isProd) {
		logger.info('Validating production security configuration');
		try {
			validateProductionSecurityConfig();
			logger.info('Production security configuration validated');
		} catch (error) {
			logger.error(error, 'Production security configuration invalid');
			throw error;
		}
	}
}
