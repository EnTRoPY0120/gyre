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

export const logger = {
	debug: (...args: any[]) => {
		if (args.length === 0) return;
		if (args.length === 1) return pinoLogger.debug(args[0]);
		if (typeof args[0] === 'string')
			return pinoLogger.debug(args.length === 2 ? args[1] : args.slice(1), args[0]);
		return pinoLogger.debug(args[0], args[1]);
	},
	info: (...args: any[]) => {
		if (args.length === 0) return;
		if (args.length === 1) return pinoLogger.info(args[0]);
		if (typeof args[0] === 'string')
			return pinoLogger.info(args.length === 2 ? args[1] : args.slice(1), args[0]);
		return pinoLogger.info(args[0], args[1]);
	},
	warn: (...args: any[]) => {
		if (args.length === 0) return;
		if (args.length === 1) return pinoLogger.warn(args[0]);
		if (typeof args[0] === 'string')
			return pinoLogger.warn(args.length === 2 ? args[1] : args.slice(1), args[0]);
		return pinoLogger.warn(args[0], args[1]);
	},
	error: (...args: any[]) => {
		if (args.length === 0) return;
		if (args.length === 1) return pinoLogger.error(args[0]);
		if (typeof args[0] === 'string')
			return pinoLogger.error(args.length === 2 ? args[1] : args.slice(1), args[0]);
		return pinoLogger.error(args[0], args[1]);
	},
	fatal: (...args: any[]) => {
		if (args.length === 0) return;
		if (args.length === 1) return pinoLogger.fatal(args[0]);
		if (typeof args[0] === 'string')
			return pinoLogger.fatal(args.length === 2 ? args[1] : args.slice(1), args[0]);
		return pinoLogger.fatal(args[0], args[1]);
	}
};
