/**
 * Production security configuration validation.
 */

export function validateProductionSecurityConfig(): void {
	if (process.env.NODE_ENV !== 'production') {
		return;
	}

	const backupKey = process.env.BACKUP_ENCRYPTION_KEY?.trim();
	if (!backupKey) {
		throw new Error('BACKUP_ENCRYPTION_KEY must be set in production!');
	}
	if (!/^[0-9a-fA-F]{64}$/.test(backupKey)) {
		throw new Error(
			'BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	const metricsToken = process.env.GYRE_METRICS_TOKEN?.trim();
	if (!metricsToken) {
		throw new Error('GYRE_METRICS_TOKEN must be set in production!');
	}
}
