import { expect, test, describe, spyOn } from 'bun:test';
import { logger } from '../lib/server/logger.js';

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
