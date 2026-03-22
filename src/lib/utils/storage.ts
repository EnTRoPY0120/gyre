import { logger } from '$lib/utils/logger.js';

/**
 * Safe localStorage wrappers that catch storage errors (quota exceeded,
 * private-browsing restrictions, etc.) and log them instead of throwing.
 *
 * Callers are responsible for browser-environment guards before calling these.
 */

export function safeGetItem(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch (err) {
		logger.warn(err, `[Storage] Failed to read key "${key}"`);
		return null;
	}
}

export function safeSetItem(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch (err) {
		logger.warn(err, `[Storage] Failed to write key "${key}"`);
	}
}

export function safeRemoveItem(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch (err) {
		logger.warn(err, `[Storage] Failed to remove key "${key}"`);
	}
}
