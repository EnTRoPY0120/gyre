import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { dashboards, dashboardWidgets } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkPermission } from '$lib/server/rbac.js';

/**
 * DELETE /api/dashboards/[id]/widgets/[widgetId]
 * Delete a widget from a dashboard
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const db = await getDb();
	const user = locals.user;
	const { id: dashboardId, widgetId } = params;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	// Check permission for write action on dashboards
	const hasPermission = await checkPermission(user, 'write', 'Dashboard');
	if (!hasPermission) {
		return error(403, 'Permission denied');
	}

	try {
		const dashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, dashboardId)
		});

		if (!dashboard) {
			return error(404, 'Dashboard not found');
		}

		// Only owner or admin can delete widgets
		if (dashboard.ownerId !== user.id && user.role !== 'admin') {
			return error(403, 'Access denied');
		}

		await db
			.delete(dashboardWidgets)
			.where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.dashboardId, dashboardId)));

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete widget:', err);
		return error(500, 'Internal server error');
	}
};
