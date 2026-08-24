import { describe, expect, test } from 'vitest';
import { redactSensitiveFields } from '../lib/utils/logger-redaction.js';

describe('browser logger redaction', () => {
	test('preserves primitives and nullish values', () => {
		expect(redactSensitiveFields('safe')).toBe('safe');
		expect(redactSensitiveFields(42)).toBe(42);
		expect(redactSensitiveFields(null)).toBeNull();
		expect(redactSensitiveFields(undefined)).toBeUndefined();
	});

	test('redacts sensitive fields recursively without mutating input', () => {
		const input = {
			password: 'secret',
			profile: { accessToken: 'token', displayName: 'Ada' },
			items: [{ apiKey: 'key' }, 'safe']
		};

		expect(redactSensitiveFields(input)).toEqual({
			password: '[REDACTED]',
			profile: { accessToken: '[REDACTED]', displayName: 'Ada' },
			items: [{ apiKey: '[REDACTED]' }, 'safe']
		});
		expect(input.profile.accessToken).toBe('token');
	});

	test('marks circular object and array references', () => {
		const input: { name: string; self?: unknown; children: unknown[] } = {
			name: 'root',
			children: []
		};
		input.self = input;
		input.children.push(input.children);

		expect(redactSensitiveFields(input)).toEqual({
			name: 'root',
			self: '[Circular]',
			children: ['[Circular]']
		});
	});

	test('keeps Error details while redacting enumerable fields', () => {
		const error = new Error('Request failed');
		Object.assign(error, { token: 'secret-token', context: { email: 'ada@example.com' } });

		expect(redactSensitiveFields(error)).toMatchObject({
			name: 'Error',
			message: 'Request failed',
			token: '[REDACTED]',
			context: { email: '[REDACTED]' }
		});
	});
});
