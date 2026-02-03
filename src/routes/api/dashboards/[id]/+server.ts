import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { dashboards, dashboardWidgets } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

function generateId(): string {
	return randomBytes(16).toString('hex');
}

/**
 * GET /api/dashboards/[id]
 * Get a specific dashboard
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const db = await getDb();
	const user = locals.user;
	const { id } = params;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	if (!id) {
		return error(400, 'Dashboard ID is required');
	}

	try {
		const dashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, id),
			with: {
				widgets: true
			}
		});

		if (!dashboard) {
			return error(404, 'Dashboard not found');
		}

		// Check visibility
		if (
			dashboard.ownerId !== user.id &&
			!dashboard.isShared &&
			!dashboard.isDefault &&
			user.role !== 'admin'
		) {
			return error(403, 'Access denied');
		}

		return json(dashboard);
	} catch (err) {
		console.error('Failed to get dashboard:', err);
		if (err instanceof Error && 'status' in err) throw err;
		return error(500, 'Internal server error');
	}
};

/**
 * PATCH /api/dashboards/[id]
 * Update a dashboard
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const db = await getDb();
	const user = locals.user;
	const { id } = params;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	// Role check - only editors and admins can modify
	if (user.role === 'viewer') {
		return error(403, 'Viewers cannot modify dashboards');
	}

	try {
		const dashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, id)
		});

		if (!dashboard) {
			return error(404, 'Dashboard not found');
		}

		// Only owner or admin can edit
		if (dashboard.ownerId !== user.id && user.role !== 'admin') {
			return error(403, 'Access denied');
		}

		const body = await request.json();
		const { name, description, layout, isShared, isDefault, widgets } = body;

		const updates: Partial<typeof dashboards.$inferInsert> = {
			updatedAt: new Date()
		};

		if (name !== undefined) updates.name = name;
		if (description !== undefined) updates.description = description;
		if (layout !== undefined) updates.layout = layout ? JSON.stringify(layout) : null;
		if (isShared !== undefined) updates.isShared = !!isShared;
		if (isDefault !== undefined && user.role === 'admin') updates.isDefault = !!isDefault;

		await db.update(dashboards).set(updates).where(eq(dashboards.id, id));

		// Handle widgets update if provided
		if (widgets && Array.isArray(widgets)) {
			// Get current widgets to identify what to delete
			const currentWidgets = await db.query.dashboardWidgets.findMany({
				where: eq(dashboardWidgets.dashboardId, id)
			});
			const currentIds = currentWidgets.map((w) => w.id);
			const incomingIds = widgets.map((w: Record<string, unknown>) => w.id).filter(Boolean);

			// Delete widgets that are not in the incoming list
			const idsToDelete = currentIds.filter((cid) => !incomingIds.includes(cid));
			if (idsToDelete.length > 0) {
				await db
					.delete(dashboardWidgets)
					.where(
						and(eq(dashboardWidgets.dashboardId, id), inArray(dashboardWidgets.id, idsToDelete))
					);
			}

			// Update or Insert widgets
			for (const w of widgets) {
				const widgetData = {
					title: w.title,
					type: w.type,
					resourceType: w.resourceType,
					query: w.query,
					config: typeof w.config === 'object' ? JSON.stringify(w.config) : w.config,
					position: typeof w.position === 'object' ? JSON.stringify(w.position) : w.position
				};

				if (w.id && currentIds.includes(w.id)) {
					// Update
					await db.update(dashboardWidgets).set(widgetData).where(eq(dashboardWidgets.id, w.id));
				} else {
					// Insert
					await db.insert(dashboardWidgets).values({
						id: w.id || generateId(),
						dashboardId: id,
						...widgetData,
						createdAt: new Date()
					});
				}
			}
		}

		const updatedDashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, id),
			with: {
				widgets: true
			}
		});

		return json(updatedDashboard);
	} catch (err) {
		console.error('Failed to update dashboard:', err);
		if (err instanceof Error && 'status' in err) throw err;
		return error(500, 'Internal server error');
	}
};

/**
 * DELETE /api/dashboards/[id]
 * Delete a dashboard
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const db = await getDb();
	const user = locals.user;
	const { id } = params;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	try {
		const dashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, id)
		});

		if (!dashboard) {
			return error(404, 'Dashboard not found');
		}

		// Only owner or admin can delete
		if (dashboard.ownerId !== user.id && user.role !== 'admin') {
			return error(403, 'Access denied');
		}

		await db.delete(dashboards).where(eq(dashboards.id, id));
		// Widgets cascade delete

		return json({ success: true });
	} catch (err) {
		console.error('Failed to delete dashboard:', err);
		if (err instanceof Error && 'status' in err) throw err;
		return error(500, 'Internal server error');
	}
};
