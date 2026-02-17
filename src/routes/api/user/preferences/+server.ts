import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import type { UserPreferences } from '$lib/types/user';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	let preferences: UserPreferences;
	try {
		preferences = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	try {
		const db = await getDb();
		await db
			.update(users)
			.set({ preferences })
			.where(eq(users.id, locals.user.id));

		return json({ success: true, preferences });
	} catch (err) {
		console.error('Failed to update preferences:', err);
		throw error(500, 'Failed to update preferences');
	}
};
