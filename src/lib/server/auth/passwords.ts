import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
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
 * Format: 32 CSPRNG-selected chars with at least one char from each class.
 */
export function generateStrongPassword(): string {
	const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const lower = 'abcdefghijklmnopqrstuvwxyz';
	const digits = '0123456789';
	const specials = '!@#$%^&*';
	const alphabet = `${upper}${lower}${digits}${specials}`;

	const pick = (chars: string) => chars[randomBytes(1)[0] % chars.length];
	const passwordChars = [
		pick(upper),
		pick(lower),
		pick(digits),
		pick(specials),
		...Array.from({ length: 28 }, () => pick(alphabet))
	];

	const random = randomBytes(passwordChars.length);
	for (let i = passwordChars.length - 1; i > 0; i--) {
		const j = random[i] % (i + 1);
		[passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
	}

	return passwordChars.join('');
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
