/**
 * Admin Backups API
 * Endpoints for creating, listing, downloading, and deleting database backups.
 *
 * GET    /api/admin/backups          — List all backups
 * POST   /api/admin/backups          — Create a new backup
 * DELETE /api/admin/backups?filename= — Delete a specific backup
 */

import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { createBackup, listBackups, deleteBackup } from '$lib/server/backup';

const backupSchema = z.object({
	filename: z.string().openapi({ example: 'gyre-backup-2024-01-15T10-30-00.db' }),
	sizeBytes: z.number().openapi({ example: 1048576 }),
	createdAt: z.string().openapi({ example: '2024-01-15T10:30:00.000Z' })
});

export const _metadata = {
	GET: {
		summary: 'List database backups',
		description:
			'Retrieve a list of all available database backup files. Read permission required.',
		tags: ['Admin'],
		responses: {
			200: {
				description: 'List of backup files',
				content: {
					'application/json': {
						schema: z.object({ backups: z.array(backupSchema) })
					}
				}
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' }
		}
	},
	POST: {
		summary: 'Create database backup',
		description:
			'Create a new database backup file. The backup is stored on the server filesystem. Admin permission required.',
		tags: ['Admin'],
		responses: {
			201: {
				description: 'Backup created successfully',
				content: {
					'application/json': {
						schema: z.object({ backup: backupSchema })
					}
				}
			},
			401: { description: 'Unauthorized' },
			403: { description: 'Admin permission required' }
		}
	},
	DELETE: {
		summary: 'Delete database backup',
		description: 'Delete a specific backup file by filename. Admin permission required.',
		tags: ['Admin'],
		request: {
			query: z.object({
				filename: z.string().openapi({
					example: 'gyre-backup-2024-01-15T10-30-00.db',
					description: 'Backup filename to delete'
				})
			})
		},
		responses: {
			200: {
				description: 'Backup deleted successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean() })
					}
				}
			},
			400: { description: 'Missing filename parameter' },
			401: { description: 'Unauthorized' },
			403: { description: 'Admin permission required' },
			404: { description: 'Backup not found' }
		}
	}
};
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/rbac';

/**
 * GET /api/admin/backups
 * Returns a list of all available backups.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'read', 'DatabaseBackup', undefined, clusterId);

	try {
		const backups = listBackups();
		return json({ backups });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Failed to list backups:', err);
		throw error(500, 'Failed to list backups');
	}
};

/**
 * POST /api/admin/backups
 * Creates a new database backup.
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'admin', 'DatabaseBackup', undefined, clusterId);

	try {
		const backup = await createBackup();

		await logAudit(locals.user, 'backup:create', {
			resourceType: 'DatabaseBackup',
			resourceName: backup.filename,
			details: { sizeBytes: backup.sizeBytes }
		});

		return json({ backup }, { status: 201 });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Failed to create backup:', err);
		throw error(500, 'Failed to create backup');
	}
};

/**
 * DELETE /api/admin/backups?filename=...
 * Deletes a specific backup file.
 */
export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'admin', 'DatabaseBackup', undefined, clusterId);

	const filename = url.searchParams.get('filename');
	if (!filename) {
		throw error(400, 'Missing filename parameter');
	}

	try {
		const deleted = deleteBackup(filename);
		if (!deleted) {
			throw error(404, 'Backup not found');
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
		throw error(500, 'Failed to delete backup');
	}
};
