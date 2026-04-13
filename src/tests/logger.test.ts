import { expect, test, describe, mock, spyOn } from 'bun:test';
import { logger } from '../lib/server/logger.js?sut';

mock.restore();

describe('Logger Redaction', () => {
	test('redacts sensitive fields like password', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');

		logger.info({ password: 'supersecretpassword', other: 'safe' }, 'Test message');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = stdoutSpy.mock.calls[0][0] as string;

		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('supersecretpassword');
		expect(output).toContain('safe');

		stdoutSpy.mockRestore();
	});

	test('redacts ADMIN_PASSWORD', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');

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
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ apiKey: 'ak-secret-123', other: 'safe' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('ak-secret-123');
		stdoutSpy.mockRestore();
	});

	test('redacts accessToken field', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ accessToken: 'at-secret-456' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('at-secret-456');
		stdoutSpy.mockRestore();
	});

	test('redacts refreshToken field', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ refreshToken: 'rt-secret-789' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('rt-secret-789');
		stdoutSpy.mockRestore();
	});

	test('redacts clientSecret field', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ clientSecret: 'cs-secret-abc' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('cs-secret-abc');
		stdoutSpy.mockRestore();
	});

	test('redacts bearer field', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ bearer: 'bearer-token-xyz' }, 'Test message');
		const output = stdoutSpy.mock.calls[0][0] as string;
		expect(output).toContain('[REDACTED]');
		expect(output).not.toContain('bearer-token-xyz');
		stdoutSpy.mockRestore();
	});

	test('sanitizes newlines in log messages (log injection prevention)', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info('Safe message\nINJECTED: fake log entry');
		const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(parsed.msg).not.toContain('\nINJECTED');
		expect(parsed.msg).toContain('Safe message');
		stdoutSpy.mockRestore();
	});

	test('sanitizes carriage returns in log messages', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info('Message\r\nwith CRLF injection');
		const parsed = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(parsed.msg).not.toMatch(/\r\n/);
		stdoutSpy.mockRestore();
	});

	test('redacts nested sensitive fields via wildcard paths', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
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
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info('Just a message');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('Just a message');

		stdoutSpy.mockRestore();
	});

	test('handles object context only', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ userId: 123 });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.userId).toBe(123);

		stdoutSpy.mockRestore();
	});

	test('handles error object and message', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
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
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info({ userId: 123 }, 'User logged in');

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('User logged in');
		expect(output.userId).toBe(123);

		stdoutSpy.mockRestore();
	});

	test('handles message and context (reverse order, non-standard but supported by variadic wrapper)', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info('User logged in', { userId: 123 });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('User logged in');
		expect(output.userId).toBe(123);

		stdoutSpy.mockRestore();
	});

	test('handles error with message and extra context (3+ args)', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
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
		const stdoutSpy = spyOn(process.stdout, 'write');
		logger.info('User action', { userId: 42 }, { action: 'login' });

		expect(stdoutSpy).toHaveBeenCalled();
		const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
		expect(output.msg).toBe('User action');
		expect(output.userId).toBe(42);
		expect(output.action).toBe('login');

		stdoutSpy.mockRestore();
	});

	test('does nothing when called with no arguments', () => {
		const stdoutSpy = spyOn(process.stdout, 'write');
		// @ts-expect-error - testing invalid call
		logger.info();

		expect(stdoutSpy).not.toHaveBeenCalled();

		stdoutSpy.mockRestore();
	});
});
