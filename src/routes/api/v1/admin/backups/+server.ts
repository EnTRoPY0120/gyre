/**
 * Admin Backups API
 * Endpoints for creating, listing, downloading, and deleting database backups.
 *
 * GET    /api/admin/backups          — List all backups
 * POST   /api/admin/backups          — Create a new backup
 * DELETE /api/admin/backups?filename= — Delete a specific backup
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { createBackup, listBackups, deleteBackup } from '$lib/server/backup';

const backupSchema = z.object({
	filename: z.string().openapi({ example: 'gyre-backup-2024-01-15T10-30-00.db' }),
	sizeBytes: z.number().openapi({ example: 1048576 }),
	createdAt: z.string().openapi({ example: '2024-01-15T10:30:00.000Z' }),
	encrypted: z.boolean().openapi({
		example: true,
		description: 'Whether the backup file is encrypted at rest with AES-256-GCM'
	})
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
			401: {
				description: 'Unauthorized',
				content: { 'application/json': { schema: errorSchema } }
			},
			403: {
				description: 'Permission denied',
				content: { 'application/json': { schema: errorSchema } }
			},
			500: {
				description: 'Failed to list backups',
				content: { 'application/json': { schema: errorSchema } }
			}
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
			401: {
				description: 'Unauthorized',
				content: { 'application/json': { schema: errorSchema } }
			},
			403: {
				description: 'Admin permission required',
				content: { 'application/json': { schema: errorSchema } }
			},
			429: {
				description: 'Too Many Requests',
				content: { 'application/json': { schema: errorSchema } }
			},
			500: {
				description: 'Failed to create backup',
				content: { 'application/json': { schema: errorSchema } }
			}
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
			400: {
				description: 'Missing or invalid filename parameter',
				content: { 'application/json': { schema: errorSchema } }
			},
			401: {
				description: 'Unauthorized',
				content: { 'application/json': { schema: errorSchema } }
			},
			403: {
				description: 'Admin permission required',
				content: { 'application/json': { schema: errorSchema } }
			},
			404: {
				description: 'Backup not found',
				content: { 'application/json': { schema: errorSchema } }
			},
			429: {
				description: 'Too Many Requests',
				content: { 'application/json': { schema: errorSchema } }
			},
			500: {
				description: 'Failed to delete backup',
				content: { 'application/json': { schema: errorSchema } }
			}
		}
	}
};
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/rbac';
import { checkRateLimit } from '$lib/server/rate-limiter';

/**
 * GET /api/admin/backups
 * Returns a list of all available backups.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized', code: 'Unauthorized' });
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'read', 'DatabaseBackup', undefined, clusterId);

	try {
		const backups = listBackups();
		return json({ backups });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		logger.error(err, 'Failed to list backups:');
		throw error(500, { message: 'Failed to list backups', code: 'InternalServerError' });
	}
};

/**
 * POST /api/admin/backups
 * Creates a new database backup.
 */
export const POST: RequestHandler = async ({ locals, setHeaders }) => {
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized', code: 'Unauthorized' });
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'admin', 'DatabaseBackup', undefined, clusterId);

	checkRateLimit({ setHeaders }, `admin:${locals.user.id}`, 20, 60 * 1000);

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
		logger.error(err, 'Failed to create backup:');
		throw error(500, { message: 'Failed to create backup', code: 'InternalServerError' });
	}
};

/**
 * DELETE /api/admin/backups?filename=...
 * Deletes a specific backup file.
 */
export const DELETE: RequestHandler = async ({ locals, url, setHeaders }) => {
	if (!locals.user) {
		throw error(401, { message: 'Unauthorized', code: 'Unauthorized' });
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'admin', 'DatabaseBackup', undefined, clusterId);

	checkRateLimit({ setHeaders }, `admin:${locals.user.id}`, 20, 60 * 1000);

	const filename = url.searchParams.get('filename');
	if (!filename) {
		throw error(400, { message: 'Missing filename parameter', code: 'BadRequest' });
	}

	const BACKUP_FILENAME_RE = /^gyre-backup-[\dT\-:.]+Z?\.db(\.enc)?$/;
	if (!BACKUP_FILENAME_RE.test(filename)) {
		throw error(400, { message: 'Invalid backup filename', code: 'BadRequest' });
	}

	try {
		const deleted = deleteBackup(filename);
		if (!deleted) {
			throw error(404, { message: 'Backup not found', code: 'NotFound' });
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
		logger.error(err, 'Failed to delete backup:');
		throw error(500, { message: 'Failed to delete backup', code: 'InternalServerError' });
	}
};
