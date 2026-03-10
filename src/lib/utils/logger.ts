import { dev } from '$app/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = dev ? 'debug' : 'warn';
const currentLevelNum = LOG_LEVELS[currentLevel];

function shouldLog(level: LogLevel): boolean {
	return currentLevelNum <= LOG_LEVELS[level];
}

export const logger = {
	debug: (...args: unknown[]) => {
		if (shouldLog('debug')) console.debug(...args);
	},
	info: (...args: unknown[]) => {
		if (shouldLog('info')) console.info(...args);
	},
	warn: (...args: unknown[]) => {
		if (shouldLog('warn')) console.warn(...args);
	},
	error: (...args: unknown[]) => {
		if (shouldLog('error')) console.error(...args);
	}
};
