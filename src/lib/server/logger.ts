import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';

const requestContext = new AsyncLocalStorage<{ requestId: string; logger?: pino.Logger }>();

export function withRequestContext<T>(requestId: string, fn: () => T): T {
	return requestContext.run({ requestId }, fn);
}

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const pinoLogger = pino(
	{
		level,
		base: undefined, // Removes pid and hostname fields, which are redundant in containerized environments like Kubernetes
		timestamp: pino.stdTimeFunctions.isoTime,
		redact: {
			paths: [
				'password',
				'ADMIN_PASSWORD',
				'token',
				'secret',
				'authorization',
				'cookie',
				'email',
				'apiKey',
				'bearer',
				'accessToken',
				'refreshToken',
				'clientSecret',
				'credential',
				'err.config.data',
				'req.headers.authorization',
				'*.password',
				'*.token',
				'*.secret',
				'*.apiKey',
				'*.bearer',
				'*.accessToken',
				'*.refreshToken',
				'*.clientSecret',
				'*.authorization',
				'*.cookie',
				'*.email',
				'*.credential'
			],
			censor: '[REDACTED]'
		}
	},
	{
		write: (message) => {
			process.stdout.write(message);
		}
	}
);

function sanitizeLogMessage(msg: string): string {
	// eslint-disable-next-line no-control-regex
	return msg.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
}

function getActiveLogger(): pino.Logger {
	const store = requestContext.getStore();
	if (!store) return pinoLogger;
	if (!store.logger) store.logger = pinoLogger.child({ requestId: store.requestId });
	return store.logger;
}

function logSingleArgument(activeLogger: pino.Logger, level: pino.Level, arg: unknown) {
	if (typeof arg === 'string') return activeLogger[level](sanitizeLogMessage(arg));
	return activeLogger[level](arg);
}

function logStringFirst(activeLogger: pino.Logger, level: pino.Level, args: unknown[]) {
	const objects = args.slice(1).filter((arg: unknown) => arg !== null && typeof arg === 'object');
	if (objects.length === 0) return activeLogger[level](sanitizeLogMessage(args[0] as string));

	const errorObj = objects.find((obj: unknown) => obj instanceof Error);
	const nonErrorObjects = objects.filter((obj: unknown) => !(obj instanceof Error));
	const meta = errorObj
		? { err: errorObj, ...Object.assign({}, ...nonErrorObjects) }
		: Object.assign({}, ...objects);
	return activeLogger[level](meta, sanitizeLogMessage(args[0] as string));
}

function logObjectFirst(activeLogger: pino.Logger, level: pino.Level, args: unknown[]) {
	if (args.length === 2) {
		if (typeof args[1] === 'string') {
			return activeLogger[level](args[0], sanitizeLogMessage(args[1]));
		}
		if (typeof args[1] === 'object' && args[1] !== null) {
			return activeLogger[level](Object.assign({}, args[0], args[1]));
		}
		return activeLogger[level](args[0]);
	}

	const extras = args.slice(2).filter((arg: unknown) => arg !== null && typeof arg === 'object');
	const meta =
		args[0] instanceof Error
			? { err: args[0], ...Object.assign({}, ...extras) }
			: Object.assign({}, args[0], ...extras);
	const msg = typeof args[1] === 'string' ? sanitizeLogMessage(args[1]) : undefined;
	return activeLogger[level](meta, msg);
}

/**
 * Internal logging helper to handle multiple signature variants:
 * - `log(level, [error_or_context])`
 * - `log(level, [error_or_context, message])`
 * - `log(level, [message, context])`
 *
 * @param level - The Pino log level (e.g., 'info', 'error')
 * @param args - The arguments passed to the logger method
 */
function log(level: pino.Level, args: unknown[]) {
	if (args.length === 0) return;
	const activeLogger = getActiveLogger();
	if (args.length === 1) return logSingleArgument(activeLogger, level, args[0]);
	if (typeof args[0] === 'string') return logStringFirst(activeLogger, level, args);
	return logObjectFirst(activeLogger, level, args);
}

/**
 * Standardized Backend Logger (Pino)
 *
 * Usage Guidelines:
 * - Always pass the `error` object as the FIRST argument to preserve stack traces.
 *   Example: `logger.error(err, 'Failed to perform operation')`
 * - Use `logger.info()` for significant application state changes (e.g., startup, login).
 * - Use `logger.warn()` for non-fatal issues (e.g., retryable errors, rate limits).
 * - Use `logger.error()` for unexpected failures requiring attention.
 * - Use `logger.debug()` for detailed troubleshooting (only visible in dev).
 * - Never log PII directly; use structured fields (e.g., { userId: user.id }) instead.
 */
export const logger = {
	debug: (...args: unknown[]) => log('debug', args),
	info: (...args: unknown[]) => log('info', args),
	warn: (...args: unknown[]) => log('warn', args),
	error: (...args: unknown[]) => log('error', args),
	fatal: (...args: unknown[]) => log('fatal', args)
};
