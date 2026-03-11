import { createHmac, timingSafeEqual } from 'node:crypto';

const getSecret = () =>
	process.env.AUTH_ENCRYPTION_KEY || 'insecure-default-do-not-use-in-production';

export function generateCsrfToken(sessionId: string): string {
	return createHmac('sha256', getSecret()).update(sessionId).digest('hex');
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
	if (!token) return false;
	const expected = generateCsrfToken(sessionId);
	try {
		return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
	} catch {
		return false;
	}
}
