import pino from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const pinoLogger = pino({
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
			'err.config.data',
			'req.headers.authorization',
			'*.password',
			'*.token',
			'*.secret'
		],
		censor: '[REDACTED]'
	}
});

/**
 * Internal logging helper to handle multiple signature variants:
 * - `log(level, [error_or_context])`
 * - `log(level, [error_or_context, message])`
 * - `log(level, [message, context])`
 *
 * @param level - The Pino log level (e.g., 'info', 'error')
 * @param args - The arguments passed to the logger method
 */
function log(level: pino.Level, args: any[]) {
	if (args.length === 0) return;
	if (args.length === 1) return pinoLogger[level](args[0]);
	if (typeof args[0] === 'string') {
		// String-first: treat as message, merge remaining objects as metadata
		const objects = args.slice(1).filter((a: any) => a !== null && typeof a === 'object');
		if (objects.length === 0) return pinoLogger[level](args[0]);
		const meta = Object.assign({}, ...objects);
		return pinoLogger[level](meta, args[0]);
	}
	if (args.length === 2) return pinoLogger[level](args[0], args[1]);
	// 3+ args with non-string first arg: merge extra context objects
	const extras = args.slice(2).filter((a: any) => a !== null && typeof a === 'object');
	const meta =
		args[0] instanceof Error
			? { err: args[0], ...Object.assign({}, ...extras) }
			: Object.assign({}, args[0], ...extras);
	return pinoLogger[level](meta, args[1]);
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
	debug: (...args: any[]) => log('debug', args),
	info: (...args: any[]) => log('info', args),
	warn: (...args: any[]) => log('warn', args),
	error: (...args: any[]) => log('error', args),
	fatal: (...args: any[]) => log('fatal', args)
};
