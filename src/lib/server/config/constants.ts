/**
 * Server-side configurable constants.
 *
 * All environment variable overrides use the `GYRE_` prefix (e.g. GYRE_POLL_INTERVAL_MS).
 * Values can be overridden at runtime — no recompile needed.
 * Invalid or out-of-range values log a warning and fall back to the default.
 */

import { logger } from '../logger.js';

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
	if (raw === undefined || raw === null) return defaultValue;
	if (!STRICT_INT_RE.test(raw)) {
		logger.warn(`[config] Invalid value for ${envVar}: "${raw}". Using default: ${defaultValue}`);
		return defaultValue;
	}
	const parsed = parseInt(raw, 10);
	if (options.min !== undefined && parsed < options.min) {
		logger.warn(
			`[config] ${envVar}=${parsed} is below minimum ${options.min}. Using default: ${defaultValue}`
		);
		return defaultValue;
	}
	if (options.max !== undefined && parsed > options.max) {
		logger.warn(
			`[config] ${envVar}=${parsed} is above maximum ${options.max}. Using default: ${defaultValue}`
		);
		return defaultValue;
	}
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

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Bearer token for Prometheus metrics scraping.
 * In production, /metrics requires either this bearer token or an authenticated admin session.
 * In non-production, /metrics is public unless this token is configured.
 * env: GYRE_METRICS_TOKEN
 */
export const GYRE_METRICS_TOKEN: string | undefined = process.env.GYRE_METRICS_TOKEN || undefined;

// ---------------------------------------------------------------------------
// SSE connection limits
// ---------------------------------------------------------------------------

/**
 * Max concurrent SSE connections per authenticated session.
 * Session-based limiting is used instead of IP-based limiting because IP
 * addresses can be shared across many users (NAT, VPN, corporate proxies).
 * env: GYRE_SSE_MAX_CONNECTIONS_PER_SESSION
 */
export const SSE_MAX_CONNECTIONS_PER_SESSION = parseEnvInt(
	'GYRE_SSE_MAX_CONNECTIONS_PER_SESSION',
	3,
	{ min: 1 }
);

/** Max concurrent SSE connections per authenticated user. env: GYRE_SSE_MAX_CONNECTIONS_PER_USER */
export const SSE_MAX_CONNECTIONS_PER_USER = parseEnvInt('GYRE_SSE_MAX_CONNECTIONS_PER_USER', 5, {
	min: 1
});

/**
 * Maximum lifetime for a single SSE connection in milliseconds.
 * When the timeout elapses the server sends a SHUTDOWN event and closes the
 * stream so the client must reconnect.  0 disables the timeout (no limit).
 * env: GYRE_SSE_CONNECTION_TIMEOUT_MS
 */
export const SSE_CONNECTION_TIMEOUT_MS = parseEnvInt('GYRE_SSE_CONNECTION_TIMEOUT_MS', 0, {
	min: 0
});
