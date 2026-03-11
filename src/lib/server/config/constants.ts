/**
 * Server-side configurable constants.
 *
 * All environment variable overrides use the `GYRE_` prefix (e.g. GYRE_POLL_INTERVAL_MS).
 * Values can be overridden at runtime — no recompile needed.
 * Invalid or out-of-range values are silently ignored and the default is used instead.
 */

interface ParseEnvIntOptions {
	/** Inclusive lower bound. Values below this fall back to the default. */
	min?: number;
	/** Inclusive upper bound. Values above this fall back to the default. */
	max?: number;
}

// Matches only non-negative whole integers, with an optional leading "+".
// Rejects strings like "5s", "1.5", "-1", or whitespace-padded values.
const STRICT_INT_RE = /^\+?[0-9]+$/;

/**
 * Parse a non-negative integer from an environment variable with optional range validation.
 * Returns `defaultValue` when the variable is absent, not a strict non-negative integer
 * (e.g. "5s", "1.5", "-1" all fall back), or outside the supplied `min`/`max` bounds.
 */
export function parseEnvInt(
	envVar: string,
	defaultValue: number,
	options: ParseEnvIntOptions = {}
): number {
	const raw = process.env[envVar];
	if (!raw || !STRICT_INT_RE.test(raw)) return defaultValue;
	const parsed = parseInt(raw, 10);
	if (options.min !== undefined && parsed < options.min) return defaultValue;
	if (options.max !== undefined && parsed > options.max) return defaultValue;
	return parsed;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Maximum number of local backup files to retain. env: GYRE_MAX_LOCAL_BACKUPS */
export const MAX_LOCAL_BACKUPS = parseEnvInt('GYRE_MAX_LOCAL_BACKUPS', 10, { min: 1 });

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

/** TTL for the in-memory settings cache (ms). env: GYRE_SETTINGS_CACHE_TTL_MS */
export const SETTINGS_CACHE_TTL_MS = parseEnvInt('GYRE_SETTINGS_CACHE_TTL_MS', 30_000, {
	min: 1_000
});

/** TTL for the dashboard resource-count cache (ms). env: GYRE_DASHBOARD_CACHE_TTL_MS */
export const DASHBOARD_CACHE_TTL_MS = parseEnvInt('GYRE_DASHBOARD_CACHE_TTL_MS', 30_000, {
	min: 1_000
});

// ---------------------------------------------------------------------------
// Kubernetes / SSE polling
// ---------------------------------------------------------------------------

/**
 * How long to wait after an ADDED event before emitting notifications (ms).
 * Prevents spam during initial cluster sync. env: GYRE_SETTLING_PERIOD_MS
 */
export const SETTLING_PERIOD_MS = parseEnvInt('GYRE_SETTLING_PERIOD_MS', 30_000, { min: 0 });

/** Interval between Kubernetes API polls (ms). env: GYRE_POLL_INTERVAL_MS */
export const POLL_INTERVAL_MS = parseEnvInt('GYRE_POLL_INTERVAL_MS', 5_000, { min: 1_000 });

/** Interval between SSE heartbeat messages (ms). env: GYRE_HEARTBEAT_INTERVAL_MS */
export const HEARTBEAT_INTERVAL_MS = parseEnvInt('GYRE_HEARTBEAT_INTERVAL_MS', 30_000, {
	min: 1_000
});
