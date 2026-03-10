import { logger } from '../logger.js';
import { cleanupExpiredSessions } from '../auth.js';
import { MS_PER_HOUR, MS_PER_MINUTE, getRandomJitterMs } from '../utils/time.js';

let cleanupScheduled = false;
let isCleaning = false;
let cleanupInterval: NodeJS.Timeout | null = null;
let immediateCleanupTimeout: NodeJS.Timeout | null = null;

/**
 * Perform the cleanup with locking
 */
async function performCleanup(): Promise<void> {
	if (isCleaning) {
		logger.info('[SessionCleanup] Cleanup already in progress, skipping');
		return;
	}

	isCleaning = true;
	try {
		await cleanupExpiredSessions();
	} catch (err) {
		logger.error(err, '[SessionCleanup] Cleanup failed:');
	} finally {
		isCleaning = false;
	}
}

/**
 * Schedule periodic cleanup of expired sessions
 * Runs every hour
 */
export function scheduleSessionCleanup(): void {
	if (cleanupScheduled) {
		logger.info('[SessionCleanup] Cleanup already scheduled, skipping');
		return;
	}

	// Run cleanup every hour
	const CLEANUP_INTERVAL_MS = MS_PER_HOUR;

	logger.info(`[SessionCleanup] Scheduling session cleanup to run every hour`);

	// Run every hour
	cleanupInterval = setInterval(() => {
		performCleanup();
	}, CLEANUP_INTERVAL_MS);

	cleanupScheduled = true;

	// Also run an initial cleanup shortly after startup
	// We add a random jitter (0-10m) to prevent multiple instances from contending.
	const startupDelayWithJitter = 1 * MS_PER_MINUTE + getRandomJitterMs(10);

	immediateCleanupTimeout = setTimeout(() => {
		logger.info('[SessionCleanup] Running initial session cleanup...');
		performCleanup();
	}, startupDelayWithJitter);
}

/**
 * Stop the cleanup scheduler (useful for testing or graceful shutdown)
 */
export function stopSessionCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
	if (immediateCleanupTimeout) {
		clearTimeout(immediateCleanupTimeout);
		immediateCleanupTimeout = null;
	}
	cleanupScheduled = false;
	logger.info('[SessionCleanup] Session cleanup scheduler stopped');
}
