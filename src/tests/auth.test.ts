import { describe, test, expect } from 'bun:test';
import {
	generateStrongPassword,
	hashPassword,
	verifyPassword,
	generateSessionId,
	generateUserId
} from '../lib/server/auth';

describe('Password Hashing', () => {
	test('hashPassword produces a bcrypt hash', async () => {
		const hash = await hashPassword('test-password');
		// bcrypt hashes start with $2a$ or $2b$
		expect(hash).toMatch(/^\$2[aby]\$/);
	});

	test('hashPassword produces different hashes for the same input (unique salt)', async () => {
		const hash1 = await hashPassword('same-password');
		const hash2 = await hashPassword('same-password');
		expect(hash1).not.toBe(hash2);
	});

	test('hashPassword uses 12 salt rounds', async () => {
		const hash = await hashPassword('test-password');
		// bcrypt hash format: $2b$<rounds>$<salt+hash>
		// The rounds portion follows the version identifier
		expect(hash).toMatch(/^\$2[aby]\$12\$/);
	});

	test('verifyPassword returns true for correct password', async () => {
		const password = 'correct-password';
		const hash = await hashPassword(password);
		const result = await verifyPassword(password, hash);
		expect(result).toBe(true);
	});

	test('verifyPassword returns false for wrong password', async () => {
		const hash = await hashPassword('correct-password');
		const result = await verifyPassword('wrong-password', hash);
		expect(result).toBe(false);
	});

	test('verifyPassword returns false for empty password against real hash', async () => {
		const hash = await hashPassword('real-password');
		const result = await verifyPassword('', hash);
		expect(result).toBe(false);
	});

	test('hashPassword handles special characters', async () => {
		const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
		const hash = await hashPassword(password);
		const result = await verifyPassword(password, hash);
		expect(result).toBe(true);
	});

	test('hashPassword handles unicode passwords', async () => {
		const password = '密码🔐パスワード';
		const hash = await hashPassword(password);
		const result = await verifyPassword(password, hash);
		expect(result).toBe(true);
	});
});

describe('Session ID Generation', () => {
	test('generates a 64 character hex string (32 bytes of randomness)', () => {
		const sessionId = generateSessionId();
		expect(sessionId).toHaveLength(64);
		expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
	});

	test('generates unique session IDs', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateSessionId());
		}
		expect(ids.size).toBe(100);
	});

	test('session ID has sufficient entropy (32 bytes = 256 bits)', () => {
		const sessionId = generateSessionId();
		// 32 bytes = 64 hex chars
		const byteLength = sessionId.length / 2;
		expect(byteLength).toBe(32);
	});
});

describe('User ID Generation', () => {
	test('generates a 32 character hex string (16 bytes)', () => {
		const userId = generateUserId();
		expect(userId).toHaveLength(32);
		expect(userId).toMatch(/^[0-9a-f]{32}$/);
	});

	test('generates unique user IDs', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateUserId());
		}
		expect(ids.size).toBe(100);
	});
});

describe('Strong Password Generation', () => {
	test('generates a non-empty password', () => {
		const password = generateStrongPassword();
		expect(password.length).toBeGreaterThan(0);
	});

	test('password contains at least one special character', () => {
		const specials = '!@#$%^&*';
		// Test multiple times since it's random
		for (let i = 0; i < 20; i++) {
			const password = generateStrongPassword();
			const hasSpecial = [...password].some((ch) => specials.includes(ch));
			expect(hasSpecial).toBe(true);
		}
	});

	test('password contains digits', () => {
		for (let i = 0; i < 20; i++) {
			const password = generateStrongPassword();
			expect(password).toMatch(/\d/);
		}
	});

	test('generates different passwords each time', () => {
		const passwords = new Set<string>();
		for (let i = 0; i < 50; i++) {
			passwords.add(generateStrongPassword());
		}
		// With 30^3 * 90 * 8 = ~19M combinations, collisions in 50 samples are extremely unlikely
		expect(passwords.size).toBe(50);
	});

	test('password has reasonable length (at least 8 chars)', () => {
		for (let i = 0; i < 20; i++) {
			const password = generateStrongPassword();
			expect(password.length).toBeGreaterThanOrEqual(8);
		}
	});
});
