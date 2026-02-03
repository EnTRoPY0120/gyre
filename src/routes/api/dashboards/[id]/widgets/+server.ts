import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { dashboards, dashboardWidgets } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

function generateId(): string {
	return randomBytes(16).toString('hex');
}

/**
 * POST /api/dashboards/[id]/widgets
 * Add a widget to a dashboard
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const db = await getDb();
	const user = locals.user;
	const { id: dashboardId } = params;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	try {
		const dashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, dashboardId)
		});

		if (!dashboard) {
			return error(404, 'Dashboard not found');
		}

		// Only owner or admin can add widgets
		if (dashboard.ownerId !== user.id && user.role !== 'admin') {
			return error(403, 'Access denied');
		}

		const body = await request.json();
		const { type, title, resourceType, query, config, position } = body;

		const widgetId = generateId();
		const newWidget = {
			id: widgetId,
			dashboardId: dashboardId,
			type,
			title,
			resourceType,
			query,
			config: config || null,
			position: position || null,
			createdAt: new Date()
		};

		await db.insert(dashboardWidgets).values(newWidget);

		return json(newWidget);
	} catch (err) {
		console.error('Failed to add widget:', err);
		return error(500, 'Internal server error');
	}
};
