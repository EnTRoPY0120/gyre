/**
 * Common time constants and helpers for server-side operations
 */

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Returns a cutoff Date for a given number of retention days.
 */
export function getCutoffDate(retentionDays: number): Date {
	return new Date(Date.now() - retentionDays * MS_PER_DAY);
}

/**
 * Returns a random jitter in milliseconds within the specified range.
 * Useful for preventing multiple instances from running tasks simultaneously.
 * @param maxMinutes Maximum jitter in minutes
 */
export function getRandomJitterMs(maxMinutes: number = 30): number {
	return Math.floor(Math.random() * maxMinutes * MS_PER_MINUTE);
}
