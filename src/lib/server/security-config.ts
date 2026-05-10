/**
 * Production security configuration validation.
 */

type SecurityEnvironment = Record<string, string | undefined>;

export function validateProductionSecurityConfig(env: SecurityEnvironment = process.env): void {
	if (env.NODE_ENV !== 'production') {
		return;
	}

	const backupKey = env.BACKUP_ENCRYPTION_KEY?.trim();
	if (!backupKey) {
		throw new Error('BACKUP_ENCRYPTION_KEY must be set in production!');
	}
	if (!/^[0-9a-fA-F]{64}$/.test(backupKey)) {
		throw new Error(
			'BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	const metricsToken = env.GYRE_METRICS_TOKEN?.trim();
	if (!metricsToken) {
		throw new Error('GYRE_METRICS_TOKEN must be set in production!');
	}

	const betterAuthSecret = env.BETTER_AUTH_SECRET?.trim();
	if (!betterAuthSecret) {
		throw new Error('BETTER_AUTH_SECRET must be set in production!');
	}
	if (betterAuthSecret.length < 32) {
		throw new Error('BETTER_AUTH_SECRET must be at least 32 characters in production!');
	}

	const authKey = env.AUTH_ENCRYPTION_KEY?.trim();
	const gyreKey = env.GYRE_ENCRYPTION_KEY?.trim();
	const distinctSecrets = [
		['AUTH_ENCRYPTION_KEY', authKey],
		['GYRE_ENCRYPTION_KEY', gyreKey],
		['BACKUP_ENCRYPTION_KEY', backupKey]
	] as const;

	for (const [name, value] of distinctSecrets) {
		if (value && value === betterAuthSecret) {
			throw new Error(`BETTER_AUTH_SECRET must be distinct from ${name} in production!`);
		}
	}
}
