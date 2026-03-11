/**
 * Client-side configurable constants.
 *
 * These values are baked in at build time and cannot be overridden via environment
 * variables (browser code has no access to process.env). Adjust them here to tune
 * client behaviour across the application.
 */

// ---------------------------------------------------------------------------
// SSE / reconnection
// ---------------------------------------------------------------------------

/** Maximum number of SSE reconnect attempts before giving up. */
export const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay between SSE reconnect attempts (ms), doubled on each retry. */
export const RECONNECT_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Maximum notifications retained in localStorage and in the in-memory store. */
export const MAX_NOTIFICATIONS = 500;

/** Number of characters from a condition message used as a change-detection preview. */
export const MESSAGE_PREVIEW_LENGTH = 100;
