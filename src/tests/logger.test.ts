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
