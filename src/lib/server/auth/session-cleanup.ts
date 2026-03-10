import { cleanupExpiredSessions } from '../auth.js';

let cleanupScheduled = false;
let cleanupInterval: NodeJS.Timeout | null = null;
let immediateCleanupTimeout: NodeJS.Timeout | null = null;

/**
 * Schedule periodic cleanup of expired sessions
 * Runs every hour
 */
export function scheduleSessionCleanup(): void {
	if (cleanupScheduled) {
		console.log('[SessionCleanup] Cleanup already scheduled, skipping');
		return;
	}

	// Run cleanup every hour
	const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

	console.log(`[SessionCleanup] Scheduling session cleanup to run every hour`);

	// Run every hour
	cleanupInterval = setInterval(() => {
		cleanupExpiredSessions().catch((err) => {
			console.error('[SessionCleanup] Scheduled cleanup failed:', err);
		});
	}, CLEANUP_INTERVAL_MS);

	cleanupScheduled = true;

	// Also run an initial cleanup after 1 minute for immediate effect
	immediateCleanupTimeout = setTimeout(
		() => {
			console.log('[SessionCleanup] Running initial session cleanup...');
			cleanupExpiredSessions().catch((err) => {
				console.error('[SessionCleanup] Initial cleanup failed:', err);
			});
		},
		1 * 60 * 1000
	);
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
	console.log('[SessionCleanup] Session cleanup scheduler stopped');
}
