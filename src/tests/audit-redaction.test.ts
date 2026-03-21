import { describe, test, expect } from 'bun:test';
import { redactSensitiveFields } from '../lib/server/audit.js';

describe('redactSensitiveFields', () => {
	describe('exact key matches', () => {
		test('redacts password', () => {
			expect(redactSensitiveFields({ password: 'hunter2' })).toEqual({ password: '[REDACTED]' });
		});

		test('redacts secret', () => {
			expect(redactSensitiveFields({ secret: 'abc123' })).toEqual({ secret: '[REDACTED]' });
		});

		test('redacts token', () => {
			expect(redactSensitiveFields({ token: 'tok_xyz' })).toEqual({ token: '[REDACTED]' });
		});

		test('redacts auth', () => {
			expect(redactSensitiveFields({ auth: 'Bearer xyz' })).toEqual({ auth: '[REDACTED]' });
		});
	});

	describe('camelCase variants', () => {
		test('redacts mySecret', () => {
			expect(redactSensitiveFields({ mySecret: 'val' })).toEqual({ mySecret: '[REDACTED]' });
		});

		test('redacts dbPassword', () => {
			expect(redactSensitiveFields({ dbPassword: 'val' })).toEqual({ dbPassword: '[REDACTED]' });
		});

		test('redacts jwtToken', () => {
			expect(redactSensitiveFields({ jwtToken: 'val' })).toEqual({ jwtToken: '[REDACTED]' });
		});

		test('redacts accessToken', () => {
			expect(redactSensitiveFields({ accessToken: 'val' })).toEqual({ accessToken: '[REDACTED]' });
		});

		test('redacts refreshToken', () => {
			expect(redactSensitiveFields({ refreshToken: 'val' })).toEqual({
				refreshToken: '[REDACTED]'
			});
		});
	});

	describe('snake_case variants', () => {
		test('redacts jwt_secret', () => {
			expect(redactSensitiveFields({ jwt_secret: 'val' })).toEqual({ jwt_secret: '[REDACTED]' });
		});

		test('redacts api_password', () => {
			expect(redactSensitiveFields({ api_password: 'val' })).toEqual({
				api_password: '[REDACTED]'
			});
		});

		test('redacts encryption_token', () => {
			expect(redactSensitiveFields({ encryption_token: 'val' })).toEqual({
				encryption_token: '[REDACTED]'
			});
		});

		test('redacts client_secret', () => {
			expect(redactSensitiveFields({ client_secret: 'val' })).toEqual({
				client_secret: '[REDACTED]'
			});
		});
	});

	describe('case-insensitive matching', () => {
		test('redacts PASSWORD (uppercase)', () => {
			expect(redactSensitiveFields({ PASSWORD: 'val' })).toEqual({ PASSWORD: '[REDACTED]' });
		});

		test('redacts SecretKey (mixed case)', () => {
			expect(redactSensitiveFields({ SecretKey: 'val' })).toEqual({ SecretKey: '[REDACTED]' });
		});

		test('redacts API_TOKEN (uppercase snake)', () => {
			expect(redactSensitiveFields({ API_TOKEN: 'val' })).toEqual({ API_TOKEN: '[REDACTED]' });
		});
	});

	describe('nested objects', () => {
		test('redacts sensitive fields inside a nested object', () => {
			const input = {
				user: {
					name: 'alice',
					password: 'secret123'
				}
			};
			expect(redactSensitiveFields(input)).toEqual({
				user: {
					name: 'alice',
					password: '[REDACTED]'
				}
			});
		});

		test('redacts deeply nested sensitive fields', () => {
			const input = {
				config: {
					database: {
						dbPassword: 'pg_pass',
						host: 'localhost'
					}
				}
			};
			expect(redactSensitiveFields(input)).toEqual({
				config: {
					database: {
						dbPassword: '[REDACTED]',
						host: 'localhost'
					}
				}
			});
		});
	});

	describe('arrays', () => {
		test('redacts sensitive fields inside array elements', () => {
			const input = {
				users: [
					{ name: 'alice', jwt_secret: 'secret1' },
					{ name: 'bob', jwt_secret: 'secret2' }
				]
			};
			expect(redactSensitiveFields(input)).toEqual({
				users: [
					{ name: 'alice', jwt_secret: '[REDACTED]' },
					{ name: 'bob', jwt_secret: '[REDACTED]' }
				]
			});
		});

		test('preserves non-object array elements', () => {
			const input = { tags: ['a', 'b', 'c'] };
			expect(redactSensitiveFields(input)).toEqual({ tags: ['a', 'b', 'c'] });
		});
	});

	describe('non-sensitive fields', () => {
		test('passes through safe fields unchanged', () => {
			const input = { username: 'alice', action: 'login', count: 42, active: true };
			expect(redactSensitiveFields(input)).toEqual(input);
		});

		test('passes through null values unchanged', () => {
			const input = { username: 'alice', note: null };
			expect(redactSensitiveFields(input)).toEqual(input);
		});
	});
});
