import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { dashboards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const { id } = params;
	const db = await getDb();

	try {
		const dashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, id),
			with: {
				widgets: true
			}
		});

		if (!dashboard) {
			throw error(404, 'Dashboard not found');
		}

		// Check visibility
		if (
			dashboard.ownerId !== user.id &&
			!dashboard.isShared &&
			!dashboard.isDefault &&
			user.role !== 'admin'
		) {
			throw error(403, 'Access denied');
		}

		return {
			dashboard
		};
	} catch (err) {
		if (err instanceof Error && 'status' in err) throw err;
		console.error('Error loading dashboard:', err);
		throw error(500, 'Failed to load dashboard');
	}
};
