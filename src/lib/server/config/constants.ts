/**
 * Server-side configurable constants.
 *
 * Values can be overridden at runtime via the corresponding environment variable.
 * All numeric env vars are validated and fall back to the default if the value is invalid.
 */

function parseEnvInt(envVar: string, defaultValue: number): number {
	const raw = process.env[envVar];
	if (!raw) return defaultValue;
	const parsed = parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Maximum number of local backup files to retain. env: GYRE_MAX_LOCAL_BACKUPS */
export const MAX_LOCAL_BACKUPS = parseEnvInt('GYRE_MAX_LOCAL_BACKUPS', 10);

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

/** TTL for the in-memory settings cache (ms). env: GYRE_SETTINGS_CACHE_TTL_MS */
export const SETTINGS_CACHE_TTL_MS = parseEnvInt('GYRE_SETTINGS_CACHE_TTL_MS', 30_000);

/** TTL for the dashboard resource-count cache (ms). env: GYRE_DASHBOARD_CACHE_TTL_MS */
export const DASHBOARD_CACHE_TTL_MS = parseEnvInt('GYRE_DASHBOARD_CACHE_TTL_MS', 30_000);

// ---------------------------------------------------------------------------
// Kubernetes / SSE polling
// ---------------------------------------------------------------------------

/**
 * How long to wait after an ADDED event before emitting notifications (ms).
 * Prevents spam during initial cluster sync. env: GYRE_SETTLING_PERIOD_MS
 */
export const SETTLING_PERIOD_MS = parseEnvInt('GYRE_SETTLING_PERIOD_MS', 30_000);

/** Interval between Kubernetes API polls (ms). env: GYRE_POLL_INTERVAL_MS */
export const POLL_INTERVAL_MS = parseEnvInt('GYRE_POLL_INTERVAL_MS', 5_000);

/** Interval between SSE heartbeat messages (ms). env: GYRE_HEARTBEAT_INTERVAL_MS */
export const HEARTBEAT_INTERVAL_MS = parseEnvInt('GYRE_HEARTBEAT_INTERVAL_MS', 30_000);
