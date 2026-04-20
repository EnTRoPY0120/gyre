import { listBackups } from '$lib/server/backup.js';
import { getDb } from '$lib/server/db';
import { authProviders } from '$lib/server/db/schema';
import { logger } from '$lib/server/logger.js';
import { getAuthSettings } from '$lib/server/settings.js';
import type {
	AdminReadinessStatus,
	AdminReadinessStep,
	AdminReadinessSummary
} from '$lib/types/admin-readiness';
import { eq } from 'drizzle-orm';

interface AdminReadinessInput {
	clusterConnected: boolean;
}

export interface AdminReadinessState {
	clusterConnected: boolean;
	localLoginEnabled: boolean | null;
	enabledProviderCount: number | null;
	backupCount: number | null;
	backupEncryptionKey?: string;
	nodeEnv?: string;
}

function isValidHex256Key(value: string | undefined): boolean {
	return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim());
}

function summarizeStatus(steps: AdminReadinessStep[]): AdminReadinessSummary['status'] {
	if (steps.some((step) => step.status === 'action-required')) {
		return 'action-required';
	}
	if (steps.some((step) => step.status === 'attention')) {
		return 'attention';
	}
	return 'ready';
}

export function buildAdminReadinessSummary(state: AdminReadinessState): AdminReadinessSummary {
	const steps: AdminReadinessStep[] = [];

	steps.push({
		id: 'cluster-connectivity',
		title: 'Cluster Connectivity',
		description: state.clusterConnected
			? 'Gyre can reach the current Kubernetes API context.'
			: 'Gyre cannot reach the current Kubernetes API context.',
		status: state.clusterConnected ? 'ready' : 'action-required',
		href: '/admin/clusters',
		ctaLabel: 'Open cluster diagnostics'
	});

	if (state.localLoginEnabled === null || state.enabledProviderCount === null) {
		steps.push({
			id: 'auth-access',
			title: 'Authentication Access',
			description: 'Unable to evaluate auth provider state. Validate local login and SSO settings.',
			status: 'action-required',
			href: '/admin/auth-providers',
			ctaLabel: 'Review auth providers'
		});
	} else {
		let authStatus: AdminReadinessStatus = 'ready';
		let authDescription = 'Local login and SSO provider configuration are available.';

		if (!state.localLoginEnabled && state.enabledProviderCount === 0) {
			authStatus = 'action-required';
			authDescription = 'Enable local login or at least one SSO provider before user access breaks.';
		} else if (!state.localLoginEnabled && state.enabledProviderCount > 0) {
			authStatus = 'ready';
			authDescription = 'SSO providers are configured; local login is disabled.';
		} else if (state.localLoginEnabled && state.enabledProviderCount === 0) {
			authStatus = 'attention';
			authDescription = 'Only local login is enabled; add an SSO provider before broader rollout.';
		}

		steps.push({
			id: 'auth-access',
			title: 'Authentication Access',
			description: authDescription,
			status: authStatus,
			href: '/admin/auth-providers',
			ctaLabel: 'Review auth providers'
		});
	}

	const backupKey = state.backupEncryptionKey?.trim();
	const backupKeyPresent = Boolean(backupKey);
	const backupKeyValid = isValidHex256Key(backupKey);
	const isProduction = state.nodeEnv === 'production';

	let backupEncryptionStatus: AdminReadinessStatus = 'ready';
	let backupEncryptionDescription = 'Backup encryption key is configured and valid.';

	if (!backupKeyPresent) {
		backupEncryptionStatus = isProduction ? 'action-required' : 'attention';
		backupEncryptionDescription = isProduction
			? 'BACKUP_ENCRYPTION_KEY is required in production and is currently unset.'
			: 'BACKUP_ENCRYPTION_KEY is unset in non-production; backups will be unencrypted.';
	} else if (!backupKeyValid) {
		backupEncryptionStatus = 'action-required';
		backupEncryptionDescription =
			'BACKUP_ENCRYPTION_KEY is set but invalid. It must be 64 hexadecimal characters.';
	}

	steps.push({
		id: 'backup-encryption',
		title: 'Backup Encryption',
		description: backupEncryptionDescription,
		status: backupEncryptionStatus,
		href: '/admin/backups',
		ctaLabel: 'Review backup settings'
	});

	if (state.backupCount === null) {
		steps.push({
			id: 'backup-verification',
			title: 'Backup Verification',
			description: 'Unable to read backups from storage.',
			status: 'action-required',
			href: '/admin/backups',
			ctaLabel: 'Open backups'
		});
	} else {
		steps.push({
			id: 'backup-verification',
			title: 'Backup Verification',
			description:
				state.backupCount > 0
					? `Detected ${state.backupCount} backup${state.backupCount === 1 ? '' : 's'}.`
					: 'No backups detected yet.',
			status: state.backupCount > 0 ? 'ready' : 'attention',
			href: '/admin/backups',
			ctaLabel: 'Open backups'
		});
	}

	return {
		status: summarizeStatus(steps),
		readyCount: steps.filter((step) => step.status === 'ready').length,
		attentionCount: steps.filter((step) => step.status === 'attention').length,
		actionRequiredCount: steps.filter((step) => step.status === 'action-required').length,
		steps
	};
}

export async function getAdminReadinessSummary({
	clusterConnected
}: AdminReadinessInput): Promise<AdminReadinessSummary> {
	let localLoginEnabled: boolean | null = null;
	let enabledProviderCount: number | null = null;
	try {
		const [authSettings, db] = await Promise.all([getAuthSettings(), getDb()]);
		const enabledProviders = await db.query.authProviders.findMany({
			columns: { id: true },
			where: eq(authProviders.enabled, true)
		});
		localLoginEnabled = authSettings.localLoginEnabled;
		enabledProviderCount = enabledProviders.length;
	} catch (error) {
		logger.error(error, '[Admin Readiness] Failed to evaluate auth access readiness');
	}

	let backupCount: number | null = null;
	try {
		backupCount = listBackups().length;
	} catch (error) {
		logger.error(error, '[Admin Readiness] Failed to evaluate backup verification readiness');
	}

	return buildAdminReadinessSummary({
		clusterConnected,
		localLoginEnabled,
		enabledProviderCount,
		backupCount,
		backupEncryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
		nodeEnv: process.env.NODE_ENV
	});
}
