import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'node:crypto';
import { logger } from '../logger.js';
import { passwordSchema } from '$lib/utils/validation.js';
import { SALT_ROUNDS } from './constants.js';

export function warnIfWeakAdminPassword(password: string): void {
	const result = passwordSchema.safeParse(password);
	if (!result.success) {
		logger.warn(
			{ issues: result.error.issues.map((i) => i.message) },
			'⚠️  ADMIN_PASSWORD does not meet strength requirements.'
		);
	}
}

/**
 * Normalize username to a canonical form (lowercase, trimmed)
 */
export function normalizeUsername(username: string): string {
	return username.toLowerCase().trim();
}

/**
 * Generate a strong random password
...
 * Format: 3 random words + 3 random digits + 1 special char
 * Easy to read but secure (e.g., "BlueTiger7Sky#42")
 */
export function generateStrongPassword(): string {
	const words = [
		'Alpha',
		'Beta',
		'Gamma',
		'Delta',
		'Echo',
		'Fox',
		'Hawk',
		'Lion',
		'Bear',
		'Wolf',
		'Blue',
		'Red',
		'Green',
		'Gold',
		'Iron',
		'Steel',
		'Fire',
		'Ice',
		'Storm',
		'Thunder',
		'Cloud',
		'Sky',
		'Star',
		'Moon',
		'Sun',
		'Wave',
		'Ocean',
		'Mountain',
		'Forest',
		'River'
	];
	const specials = '!@#$%^&*';

	const word1 = words[randomInt(0, words.length)];
	const word2 = words[randomInt(0, words.length)];
	const word3 = words[randomInt(0, words.length)];
	const digits = randomInt(10, 100).toString();
	const special = specials[randomInt(0, specials.length)];

	return `${word1}${word2}${digits}${word3}${special}`;
}

/**
 * @deprecated The generated admin password is no longer stored in memory.
 * It is returned directly from createDefaultAdminIfNeeded() and written to a restricted temp file.
 */
export function getGeneratedAdminPassword(): string | null {
	return null;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export function generateUserId(): string {
	return randomBytes(16).toString('hex');
}
