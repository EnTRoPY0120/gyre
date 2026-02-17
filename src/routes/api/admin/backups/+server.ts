/**
 * Admin Backups API
 * Endpoints for creating, listing, downloading, and deleting database backups.
 *
 * GET    /api/admin/backups          — List all backups
 * POST   /api/admin/backups          — Create a new backup
 * DELETE /api/admin/backups?filename= — Delete a specific backup
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBackupSync, listBackups, deleteBackup } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';

/**
 * GET /api/admin/backups
 * Returns a list of all available backups.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const backups = listBackups();
		return json({ backups });
	} catch (err) {
		console.error('Failed to list backups:', err);
		throw error(500, { message: 'Failed to list backups' });
	}
};

/**
 * POST /api/admin/backups
 * Creates a new database backup.
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const backup = createBackupSync();

		await logAudit(locals.user, 'backup:create', {
			resourceType: 'DatabaseBackup',
			resourceName: backup.filename,
			details: { sizeBytes: backup.sizeBytes }
		});

		return json({ backup }, { status: 201 });
	} catch (err) {
		console.error('Failed to create backup:', err);
		throw error(500, { message: 'Failed to create backup' });
	}
};

/**
 * DELETE /api/admin/backups?filename=...
 * Deletes a specific backup file.
 */
export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const filename = url.searchParams.get('filename');
	if (!filename) {
		throw error(400, { message: 'Missing filename parameter' });
	}

	try {
		const deleted = deleteBackup(filename);
		if (!deleted) {
			throw error(404, { message: 'Backup not found' });
		}

		await logAudit(locals.user, 'backup:delete', {
			resourceType: 'DatabaseBackup',
			resourceName: filename
		});

		return json({ success: true });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to delete backup:', err);
		throw error(500, { message: 'Failed to delete backup' });
	}
};
