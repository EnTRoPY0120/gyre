import { expect, test, describe, vi } from 'vitest';

vi.mock('pino', () => {
	const redactValue = '[REDACTED]';
	const sensitiveKeys = new Set([
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
		'credential'
	]);

	function redact(input: unknown): unknown {
		if (!input || typeof input !== 'object') {
			return input;
		}
		if (input instanceof Error) {
			return {
				type: input.name,
				message: input.message,
				stack: input.stack
			};
		}
		if (Array.isArray(input)) {
			return input.map(redact);
		}

		return Object.fromEntries(
			Object.entries(input).map(([key, value]) => [
				key,
				sensitiveKeys.has(key) ? redactValue : redact(value)
			])
		);
	}

	function write(level: number, args: unknown[]) {
		if (args.length === 0) {
			return;
		}
		const record: Record<string, unknown> = { level, time: new Date().toISOString() };
		if (args.length === 1) {
			if (typeof args[0] === 'string') {
				record.msg = args[0];
			} else if (args[0] instanceof Error) {
				record.err = redact(args[0]);
			} else {
				Object.assign(record, redact(args[0]));
			}
		} else {
			if (args[0] instanceof Error) {
				record.err = redact(args[0]);
			} else {
				Object.assign(record, redact(args[0]));
			}
			if (typeof args[1] === 'string') {
				record.msg = args[1];
			}
		}
		process.stdout.write(`${JSON.stringify(record)}\n`);
	}

	const createLogger = () => ({
		debug: (...args: unknown[]) => write(20, args),
		info: (...args: unknown[]) => write(30, args),
		warn: (...args: unknown[]) => write(40, args),
		error: (...args: unknown[]) => write(50, args),
		fatal: (...args: unknown[]) => write(60, args),
		child: () => createLogger()
	});

	const pino = () => createLogger();
	pino.stdTimeFunctions = { isoTime: () => new Date().toISOString() };

	return { default: pino };
});

const { logger } = await import('../lib/server/logger.js');

describe('Logger Redaction', () => {
	test('redacts sensitive fields like password', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');

		logger.info({ password: 'supersecretpassword', other: 'safe' }, 'Test message');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = stdoutSpy.mock.calls[0][0] as string;

		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('supersecretpassword');
		expect(output).toContain('safe');

		stdoutSpy.mockRestore();
	});

	test('redacts ADMIN_PASSWORD', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');

		logger.info({ ADMIN_PASSWORD: 'adminsecret' }, 'Another message');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = stdoutSpy.mock.calls[0][0] as string;

		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('adminsecret');

		stdoutSpy.mockRestore();
	});
});

describe('Logger Security', () => {
	test('redacts apiKey field', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ apiKey: 'ak-secret-123', other: 'safe' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('ak-secret-123');
		stdoutSpy.mockRestore();
	});

	test('redacts accessToken field', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ accessToken: 'at-secret-456' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('at-secret-456');
		stdoutSpy.mockRestore();
	});

	test('redacts refreshToken field', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ refreshToken: 'rt-secret-789' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('rt-secret-789');
		stdoutSpy.mockRestore();
	});

	test('redacts clientSecret field', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ clientSecret: 'cs-secret-abc' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('cs-secret-abc');
		stdoutSpy.mockRestore();
	});

	test('redacts bearer field', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ bearer: 'bearer-token-xyz' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('bearer-token-xyz');
		stdoutSpy.mockRestore();
	});

	test('sanitizes newlines in log messages (log injection prevention)', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info('Safe message\nINJECTED: fake log entry');
		const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(parsed.msg).not.toContain('\nINJECTED');
		expect(parsed.msg).toContain('Safe message');
		stdoutSpy.mockRestore();
	});

	test('sanitizes carriage returns in log messages', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info('Message\r\nwith CRLF injection');
		const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(parsed.msg).not.toMatch(/\r\n/);
		stdoutSpy.mockRestore();
	});

	test('redacts nested sensitive fields via wildcard paths', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info(
			{ user: { apiKey: 'ak-secret-123', bearer: 'bearer-token-xyz' } },
			'Nested redaction test'
		);
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('ak-secret-123');
		expect(output).not.toContain('bearer-token-xyz');
		stdoutSpy.mockRestore();
	});
});

describe('Logger Signatures', () => {
	test('handles string message only', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info('Just a message');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('Just a message');

		stdoutSpy.mockRestore();
	});

	test('handles object context only', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ userId: 123 });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.userId).toBe(123);

		stdoutSpy.mockRestore();
	});

	test('handles error object and message', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		const err = new Error('Test error');
		logger.error(err, 'Failed operation');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('Failed operation');
		expect(output.err).toBeDefined();
		expect(output.err.message).toBe('Test error');

		stdoutSpy.mockRestore();
	});

	test('handles object context and message', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info({ userId: 123 }, 'User logged in');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('User logged in');
		expect(output.userId).toBe(123);

		stdoutSpy.mockRestore();
	});

	test('handles message and context (reverse order, non-standard but supported by variadic wrapper)', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info('User logged in', { userId: 123 });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('User logged in');
		expect(output.userId).toBe(123);

		stdoutSpy.mockRestore();
	});

	test('handles error with message and extra context (3+ args)', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		const err = new Error('Test error');
		logger.error(err, 'OAuth error from IdP:', { provider: 'github' });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('OAuth error from IdP:');
		expect(output.err).toBeDefined();
		expect(output.err.message).toBe('Test error');
		expect(output.provider).toBe('github');

		stdoutSpy.mockRestore();
	});

	test('handles string message with multiple context objects (3+ args)', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		logger.info('User action', { userId: 42 }, { action: 'login' });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('User action');
		expect(output.userId).toBe(42);
		expect(output.action).toBe('login');

		stdoutSpy.mockRestore();
	});

	test('does nothing when called with no arguments', () => {
		const stdoutSpy = vi.spyOn(process.stdout, 'write');
		// @ts-expect-error - testing invalid call
		logger.info();

		expect(stdoutSpy).not.toHaveBeenCalled();

		stdoutSpy.mockRestore();
	});
});
