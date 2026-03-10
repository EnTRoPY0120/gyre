import pino from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const pinoLogger = pino({
	level,
	base: undefined,
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

function log(level: pino.Level, args: any[]) {
	if (args.length === 0) return;
	if (args.length === 1) return pinoLogger[level](args[0]);
	if (typeof args[0] === 'string') {
		return pinoLogger[level](args.length === 2 ? args[1] : args.slice(1), args[0]);
	}
	return pinoLogger[level](args[0], args[1]);
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
