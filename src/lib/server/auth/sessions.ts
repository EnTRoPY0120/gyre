import { randomBytes } from 'node:crypto';
import { lte, eq } from 'drizzle-orm';
import { logger } from '../logger.js';
import { getDb } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { sessionsCleanedUpTotal } from '../metrics.js';

// Session ID generation
export function generateSessionId(): string {
	return randomBytes(32).toString('hex');
}

export async function deleteUserSessions(userId: string): Promise<void> {
	const db = await getDb();
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function cleanupExpiredSessions(): Promise<number> {
	const db = await getDb();
	const now = new Date();
	const result = await db
		.delete(sessions)
		.where(lte(sessions.expiresAt, now))
		.returning({ id: sessions.id });

	const count = result.length;
	if (count > 0) {
		sessionsCleanedUpTotal.inc(count);
		logger.info(`[Auth] Cleaned up ${count} expired session(s)`);
	}
	return count;
}
