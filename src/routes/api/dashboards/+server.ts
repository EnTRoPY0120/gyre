import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { dashboards, dashboardWidgets } from '$lib/server/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { checkPermission } from '$lib/server/rbac.js';

function generateId(): string {
	return randomBytes(16).toString('hex');
}

/**
 * GET /api/dashboards
 * List dashboards visible to the user
 */
export const GET: RequestHandler = async ({ locals }) => {
	const db = await getDb();
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Fetch dashboards that are either owned by the user, or shared, or default
		const userDashboards = await db.query.dashboards.findMany({
			where: or(
				eq(dashboards.ownerId, user.id),
				eq(dashboards.isShared, true),
				eq(dashboards.isDefault, true)
			),
			orderBy: [desc(dashboards.createdAt)],
			with: {
				widgets: true
			}
		});

		return json(userDashboards);
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;
		console.error('Failed to list dashboards:', err);
		throw error(500, 'Internal server error');
	}
};

/**
 * POST /api/dashboards
 * Create a new dashboard
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const db = await getDb();
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	// Check permission for write action on dashboards
	const hasPermission = await checkPermission(user, 'write', 'Dashboard');
	if (!hasPermission) {
		throw error(403, 'Permission denied');
	}

	try {
		const body = await request.json();
		const { name, description, layout, isShared, isDefault, widgets } = body;

		if (!name) {
			throw error(400, 'Name is required');
		}

		const dashboardId = generateId();
		const now = new Date();

		await db.insert(dashboards).values({
			id: dashboardId,
			name,
			description,
			ownerId: user.id,
			isShared: !!isShared,
			isDefault: !!isDefault, // Only admins should generally set this, but we'll allow for now or add check
			layout: layout ? JSON.stringify(layout) : null,
			createdAt: now,
			updatedAt: now
		});

		// Insert widgets if provided
		if (widgets && Array.isArray(widgets) && widgets.length > 0) {
			const newWidgets = widgets.map(
				(w: {
					type: string;
					title: string;
					resourceType?: string;
					query?: string;
					config?: unknown;
					position?: unknown;
				}) => ({
					id: generateId(),
					dashboardId: dashboardId,
					type: w.type as string,
					title: w.title as string,
					resourceType: w.resourceType as string | null,
					query: w.query as string | null,
					config: w.config ? JSON.stringify(w.config) : null,
					position: w.position ? JSON.stringify(w.position) : null,
					createdAt: now
				})
			);

			await db.insert(dashboardWidgets).values(newWidgets);
		}

		const newDashboard = await db.query.dashboards.findFirst({
			where: eq(dashboards.id, dashboardId),
			with: {
				widgets: true
			}
		});

		return json(newDashboard);
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;
		console.error('Failed to create dashboard:', err);
		throw error(500, 'Internal server error');
	}
};
