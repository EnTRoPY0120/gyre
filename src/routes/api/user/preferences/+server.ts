import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import type { UserPreferences } from '$lib/types/user';
import { requirePermission } from '$lib/server/rbac';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!locals.cluster) {
		throw error(400, 'Missing cluster context');
	}

	// Ensure the user has at least 'read' permission on the cluster to manage their own notifications
	await requirePermission(locals.user, 'read', undefined, undefined, locals.cluster);

	let newPreferences: Partial<UserPreferences>;

	try {
		newPreferences = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	// Validate that newPreferences is a plain object

	if (
		typeof newPreferences !== 'object' ||
		newPreferences === null ||
		Array.isArray(newPreferences)
	) {
		throw error(400, 'Invalid preferences payload');
	}

	try {
		const db = await getDb();

		// Fetch existing preferences

		const user = await db.query.users.findFirst({
			where: eq(users.id, locals.user.id),

			columns: {
				preferences: true
			}
		});

		const existingPreferences = (user?.preferences as UserPreferences) || {};

		// Merge preferences (shallow merge for now, but preserving notifications specifically)

		const mergedPreferences: UserPreferences = {
			...existingPreferences,

			...newPreferences,

			notifications: {
				...(existingPreferences.notifications || {}),

				...(newPreferences.notifications || {})
			}
		};

		await db

			.update(users)

			.set({ preferences: mergedPreferences })

			.where(eq(users.id, locals.user.id));

		return json({ success: true, preferences: mergedPreferences });
	} catch (err) {
		console.error('Failed to update preferences:', err);

		throw error(500, 'Failed to update preferences');
	}
};
