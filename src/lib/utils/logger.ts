/* eslint-disable no-console */
import { dev } from '$app/environment';

import { env } from '$env/dynamic/public';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_COLORS: Record<LogLevel, string> = {
	debug: 'color: #888888',
	info: 'color: #3b82f6',
	warn: 'color: #f59e0b',
	error: 'color: #ef4444'
};

const configuredLevel = (env.PUBLIC_LOG_LEVEL as LogLevel) ?? (dev ? 'debug' : 'warn');
const currentLevel: LogLevel =
	LOG_LEVELS[configuredLevel] !== undefined ? configuredLevel : dev ? 'debug' : 'warn';
const currentLevelNum = LOG_LEVELS[currentLevel];

export function shouldLog(level: LogLevel): boolean {
	return currentLevelNum <= LOG_LEVELS[level];
}

const SENSITIVE_KEYS = /^(password|token|secret|authorization|cookie|email)$/i;

function redactSensitiveFields(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) return value.map(redactSensitiveFields);
	if (typeof value === 'object' && !(value instanceof Error)) {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			result[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redactSensitiveFields(v);
		}
		return result;
	}
	return value;
}

function formatBrowserLog(level: LogLevel, args: unknown[]): unknown[] {
	const sanitized = args.map(redactSensitiveFields);
	if (sanitized.length > 0) {
		if (typeof sanitized[0] === 'string') {
			return [
				`%c[${level.toUpperCase()}] %c${sanitized[0]}`,
				LOG_COLORS[level],
				'color: inherit',
				...sanitized.slice(1)
			];
		} else if (sanitized.length > 1 && typeof sanitized[1] === 'string') {
			return [
				`%c[${level.toUpperCase()}] %c${sanitized[1]}`,
				LOG_COLORS[level],
				'color: inherit',
				sanitized[0],
				...sanitized.slice(2)
			];
		}
	}
	return [`%c[${level.toUpperCase()}]`, LOG_COLORS[level], ...sanitized];
}

/**
 * Standardized Frontend Logger
 *
 * Usage Guidelines:
 * - This logger mirrors the backend API but runs in the browser.
 * - In production, `PUBLIC_LOG_LEVEL` defaults to `warn` to keep the console clean (this means `warn`, `error`, and `fatal` logs are visible).
 * - Use `logger.error()` for unhandled exceptions or critical UI failures.
 * - Use `logger.warn()` for recoverable issues or deprecations.
 * - Use `logger.info()` for significant user flows (e.g., "User signed in").
 * - Use `logger.debug()` for granular state tracking (only visible in dev or if explicitly enabled).
 * - For expensive log computations, consider lazy evaluation by wrapping the log call in a check:
 *   `if (shouldLog('debug')) logger.debug(heavyComputation())`
 *
 * Signature Differences from Backend:
 * - The frontend logger uses the browser console directly. While it supports `logger.info(obj, 'msg')` and
 *   `logger.error(err, 'msg')`, complex nested object formatting relies on the browser's native console inspector.
 */
export const logger = {
	debug: (...args: unknown[]) => {
		if (shouldLog('debug')) console.debug(...formatBrowserLog('debug', args));
	},
	info: (...args: unknown[]) => {
		if (shouldLog('info')) console.info(...formatBrowserLog('info', args));
	},
	warn: (...args: unknown[]) => {
		if (shouldLog('warn')) console.warn(...formatBrowserLog('warn', args));
	},
	error: (...args: unknown[]) => {
		if (shouldLog('error')) console.error(...formatBrowserLog('error', args));
	},
	fatal: (...args: unknown[]) => {
		// Browser console doesn't have a specific 'fatal' level, so fallback to 'error'
		if (shouldLog('error')) console.error(...formatBrowserLog('error', args));
	}
};
