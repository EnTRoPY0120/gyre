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

export const logger = {
	debug: (...args: any[]) => log('debug', args),
	info: (...args: any[]) => log('info', args),
	warn: (...args: any[]) => log('warn', args),
	error: (...args: any[]) => log('error', args),
	fatal: (...args: any[]) => log('fatal', args)
};
