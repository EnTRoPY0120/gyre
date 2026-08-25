import { listBackups } from '$lib/server/backup.js';
import { ADMIN_READINESS_CACHE_TTL_MS } from '$lib/server/config/constants';
import { getDb } from '$lib/server/db';
import { authProviders } from '$lib/server/db/schema';
import { logger } from '$lib/server/logger.js';
import { getAuthSettings } from '$lib/server/settings.js';
import type { AdminReadinessStep, AdminReadinessSummary } from '$lib/types/admin-readiness';
import { count, eq } from 'drizzle-orm';
import {
	buildAuthAccessStep,
	buildBackupEncryptionStep,
	buildBackupVerificationStep,
	buildClusterConnectivityStep
} from './admin-readiness-steps.js';

interface AdminReadinessInput {
	clusterConnected: boolean;
}

type AuthSettingsSnapshot = Awaited<ReturnType<typeof getAuthSettings>>;
type AdminReadinessCacheSlot = 'authSettings' | 'enabledProviderCount' | 'backupCount';
type AdminReadinessCacheValueBySlot = {
	authSettings: AuthSettingsSnapshot;
	enabledProviderCount: number;
	backupCount: number;
};

interface AdminReadinessFailureMarker {
	__adminReadinessFailure: true;
	slot: AdminReadinessCacheSlot;
	causeMessage: string;
}

interface TimedCacheEntry<T> {
	value: T;
	timestamp: number;
	ttlMs: number;
}

/**
 * Cached dependency reads used by getAdminReadinessSummary.
 *
 * Cache keys:
 * - authSettings: getAuthSettings()
 * - enabledProviderCount: getDb().select({ count: count() }).from(authProviders)...
 * - backupCount: listBackups().length
 *
 * Success TTL is ADMIN_READINESS_CACHE_TTL_MS.
 * Failures are cached briefly to avoid repeatedly hammering broken dependencies.
 */
const adminReadinessCache: {
	[K in AdminReadinessCacheSlot]: TimedCacheEntry<
		AdminReadinessCacheValueBySlot[K] | AdminReadinessFailureMarker
	> | null;
} = {
	authSettings: null,
	enabledProviderCount: null,
	backupCount: null
};

const adminReadinessInflight: {
	[K in AdminReadinessCacheSlot]: Promise<AdminReadinessCacheValueBySlot[K]> | null;
} = {
	authSettings: null,
	enabledProviderCount: null,
	backupCount: null
};
let adminReadinessGeneration = 0;
type AdminReadinessCacheStore = typeof adminReadinessCache;
type AdminReadinessInflightStore = typeof adminReadinessInflight;

const ADMIN_READINESS_FAILURE_CACHE_TTL_MS = Math.max(
	1_000,
	Math.floor(ADMIN_READINESS_CACHE_TTL_MS / 4)
);

function readIfFresh<T>(entry: TimedCacheEntry<T> | null): T | null {
	if (entry === null) {
		return null;
	}
	if (Date.now() - entry.timestamp >= entry.ttlMs) {
		return null;
	}
	return entry.value;
}

function writeCache<T>(value: T, ttlMs = ADMIN_READINESS_CACHE_TTL_MS): TimedCacheEntry<T> {
	return {
		value,
		timestamp: Date.now(),
		ttlMs
	};
}

function isFailureMarker(value: unknown): value is AdminReadinessFailureMarker {
	if (value === null || typeof value !== 'object') {
		return false;
	}

	const candidate = value as { __adminReadinessFailure?: unknown };
	return candidate.__adminReadinessFailure === true;
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

async function getCached<K extends AdminReadinessCacheSlot>(
	slot: K,
	fetcher: () => Promise<AdminReadinessCacheValueBySlot[K]>
): Promise<AdminReadinessCacheValueBySlot[K]> {
	const cached = readIfFresh(
		adminReadinessCache[slot] as TimedCacheEntry<
			AdminReadinessCacheValueBySlot[K] | AdminReadinessFailureMarker
		> | null
	);
	if (cached !== null) {
		if (isFailureMarker(cached)) {
			throw new Error(`[Admin Readiness] Cached ${slot} fetch failure: ${cached.causeMessage}`);
		}
		return cached;
	}
	const existingInflight = adminReadinessInflight[slot] as Promise<
		AdminReadinessCacheValueBySlot[K]
	> | null;
	if (existingInflight !== null) {
		return existingInflight;
	}
	const generation = adminReadinessGeneration;

	const nextInflight: Promise<AdminReadinessCacheValueBySlot[K]> = fetcher()
		.then((value) => {
			if (generation === adminReadinessGeneration) {
				adminReadinessCache[slot] = writeCache(value) as AdminReadinessCacheStore[K];
			}
			return value;
		})
		.catch((error: unknown) => {
			if (generation === adminReadinessGeneration) {
				adminReadinessCache[slot] = writeCache(
					{
						__adminReadinessFailure: true,
						slot,
						causeMessage: toErrorMessage(error)
					},
					ADMIN_READINESS_FAILURE_CACHE_TTL_MS
				) as AdminReadinessCacheStore[K];
			}
			throw error;
		})
		.finally(() => {
			if (generation === adminReadinessGeneration) {
				adminReadinessInflight[slot] = null;
			}
		});

	adminReadinessInflight[slot] = nextInflight as AdminReadinessInflightStore[K];
	return nextInflight;
}

async function getCachedAuthSettings(): Promise<AuthSettingsSnapshot> {
	return getCached('authSettings', getAuthSettings);
}

async function getCachedEnabledProviderCount(): Promise<number> {
	return getCached('enabledProviderCount', async () => {
		const db = await getDb();
		const [row] = await db
			.select({ count: count() })
			.from(authProviders)
			.where(eq(authProviders.enabled, true));
		const enabledProviderCount = row?.count ?? 0;
		return typeof enabledProviderCount === 'bigint'
			? Number(enabledProviderCount)
			: enabledProviderCount;
	});
}

async function getCachedBackupCount(): Promise<number> {
	return getCached('backupCount', async () => listBackups().length);
}

export interface AdminReadinessState {
	clusterConnected: boolean;
	localLoginEnabled: boolean | null;
	enabledProviderCount: number | null;
	backupCount: number | null;
	backupEncryptionKey?: string;
	nodeEnv?: string;
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
	const steps = [
		buildClusterConnectivityStep(state.clusterConnected),
		buildAuthAccessStep(state.localLoginEnabled, state.enabledProviderCount),
		buildBackupEncryptionStep(state.backupEncryptionKey, state.nodeEnv),
		buildBackupVerificationStep(state.backupCount)
	];

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
	let backupCount: number | null = null;

	const [authSettingsResult, enabledProviderCountResult, backupCountResult] =
		await Promise.allSettled([
			getCachedAuthSettings(),
			getCachedEnabledProviderCount(),
			getCachedBackupCount()
		]);

	if (authSettingsResult.status === 'fulfilled') {
		localLoginEnabled = authSettingsResult.value.localLoginEnabled;
	} else {
		logger.error(authSettingsResult.reason, '[Admin Readiness] Failed to read auth settings');
	}
	if (enabledProviderCountResult.status === 'fulfilled') {
		enabledProviderCount = enabledProviderCountResult.value;
	} else {
		logger.error(
			enabledProviderCountResult.reason,
			'[Admin Readiness] Failed to count enabled auth providers'
		);
	}
	if (backupCountResult.status === 'fulfilled') {
		backupCount = backupCountResult.value;
	} else {
		logger.error(
			backupCountResult.reason,
			'[Admin Readiness] Failed to evaluate backup verification readiness'
		);
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
