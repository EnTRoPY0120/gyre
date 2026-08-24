import type { AdminReadinessStatus, AdminReadinessStep } from '$lib/types/admin-readiness';

function isValidHex256Key(value: string | undefined): boolean {
	return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim());
}

export function buildClusterConnectivityStep(clusterConnected: boolean): AdminReadinessStep {
	return {
		id: 'cluster-connectivity',
		title: 'Cluster Connectivity',
		description: clusterConnected
			? 'Gyre can reach the current Kubernetes API context.'
			: 'Gyre cannot reach the current Kubernetes API context.',
		status: clusterConnected ? 'ready' : 'action-required',
		href: '/admin/clusters',
		ctaLabel: 'Open cluster diagnostics'
	};
}

export function buildAuthAccessStep(
	localLoginEnabled: boolean | null,
	enabledProviderCount: number | null
): AdminReadinessStep {
	if (localLoginEnabled === null || enabledProviderCount === null) {
		return {
			id: 'auth-access',
			title: 'Authentication Access',
			description: 'Unable to evaluate auth provider state. Validate local login and SSO settings.',
			status: 'action-required',
			href: '/admin/auth-providers',
			ctaLabel: 'Review auth providers'
		};
	}

	let status: AdminReadinessStatus = 'ready';
	let description = 'Local login and SSO provider configuration are available.';
	if (!localLoginEnabled && enabledProviderCount === 0) {
		status = 'action-required';
		description = 'Enable local login or at least one SSO provider before user access breaks.';
	} else if (localLoginEnabled && enabledProviderCount === 0) {
		status = 'attention';
		description = 'Only local login is enabled; add an SSO provider before broader rollout.';
	} else if (!localLoginEnabled) {
		description = 'SSO providers are configured; local login is disabled.';
	}

	return {
		id: 'auth-access',
		title: 'Authentication Access',
		description,
		status,
		href: '/admin/auth-providers',
		ctaLabel: 'Review auth providers'
	};
}

export function buildBackupEncryptionStep(
	backupEncryptionKey: string | undefined,
	nodeEnv: string | undefined
): AdminReadinessStep {
	const backupKey = backupEncryptionKey?.trim();
	const isProduction = nodeEnv === 'production';
	let status: AdminReadinessStatus = 'ready';
	let description = 'Backup encryption key is configured and valid.';

	if (!backupKey) {
		status = isProduction ? 'action-required' : 'attention';
		description = isProduction
			? 'BACKUP_ENCRYPTION_KEY is required in production and is currently unset.'
			: 'BACKUP_ENCRYPTION_KEY is unset in non-production; backups will be unencrypted.';
	} else if (!isValidHex256Key(backupKey)) {
		status = 'action-required';
		description = 'BACKUP_ENCRYPTION_KEY is set but invalid. It must be 64 hexadecimal characters.';
	}

	return {
		id: 'backup-encryption',
		title: 'Backup Encryption',
		description,
		status,
		href: '/admin/backups',
		ctaLabel: 'Review backup settings'
	};
}

export function buildBackupVerificationStep(backupCount: number | null): AdminReadinessStep {
	if (backupCount === null) {
		return {
			id: 'backup-verification',
			title: 'Backup Verification',
			description: 'Unable to read backups from storage.',
			status: 'action-required',
			href: '/admin/backups',
			ctaLabel: 'Open backups'
		};
	}

	return {
		id: 'backup-verification',
		title: 'Backup Verification',
		description:
			backupCount > 0
				? `Detected ${backupCount} backup${backupCount === 1 ? '' : 's'}.`
				: 'No backups detected yet.',
		status: backupCount > 0 ? 'ready' : 'attention',
		href: '/admin/backups',
		ctaLabel: 'Open backups'
	};
}
