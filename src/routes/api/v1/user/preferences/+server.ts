import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import type { UserPreferences } from '$lib/types/user';
import { checkRateLimit } from '$lib/server/rate-limiter';
import { logAudit } from '$lib/server/audit';
import { preferencesSchema } from '$lib/server/user-preferences';

export const _metadata = {
	POST: {
		summary: 'Update user preferences',
		description: "Update the current user's preferences like theme and notifications.",
		tags: ['User'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: preferencesSchema
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Preferences updated successfully',
				content: {
					'application/json': {
						schema: z.object({
							success: z.boolean(),
							preferences: preferencesSchema
						})
					}
				}
			},
			400: {
				description: 'Bad request (invalid JSON or validation failure)',
				content: { 'application/json': { schema: errorSchema } }
			},
			401: {
				description: 'Unauthorized',
				content: { 'application/json': { schema: errorSchema } }
			},
			500: {
				description: 'Failed to update preferences',
				content: { 'application/json': { schema: errorSchema } }
			}
		}
	}
};

export const POST: RequestHandler = async ({ request, locals, setHeaders }) => {
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized', code: 'Unauthorized' });
	}

	checkRateLimit({ setHeaders }, `preferences:${locals.user.id}`, 30, 60 * 1000);

	let rawBody: unknown;

	try {
		rawBody = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON', code: 'BadRequest' });
	}

	const parsed = preferencesSchema.safeParse(rawBody);
	if (!parsed.success) {
		throw error(400, {
			message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
			code: 'BadRequest'
		});
	}

	const newPreferences: Partial<UserPreferences> = parsed.data;

	try {
		const db = await getDb();
		const preferencesPatch = JSON.stringify(newPreferences);
		const [updatedUser] = await db
			.update(users)
			.set({
				preferences: sql<UserPreferences>`json_patch(coalesce(${users.preferences}, '{}'), json(${preferencesPatch}))`,
				updatedAt: new Date()
			})
			.where(eq(users.id, locals.user.id))
			.returning({ preferences: users.preferences });

		if (!updatedUser) {
			throw error(404, { message: 'User not found', code: 'NotFound' });
		}

		const mergedPreferences = (updatedUser.preferences as UserPreferences) || {};

		await logAudit(locals.user, 'preferences:update', {
			resourceType: 'UserPreferences',
			...(locals.cluster ? { clusterId: locals.cluster } : {}),
			details: { updatedFields: Object.keys(newPreferences) }
		});

		return json({ success: true, preferences: mergedPreferences });
	} catch (err) {
		if (isHttpError(err)) throw err;
		logger.error(err, 'Failed to update preferences:');

		throw error(500, { message: 'Failed to update preferences', code: 'InternalServerError' });
	}
};
