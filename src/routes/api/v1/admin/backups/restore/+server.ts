/**
 * Admin Backup Restore API
 * POST /api/admin/backups/restore — Restore database from an uploaded backup file
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { restoreFromBuffer } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/rbac';
import { REQUEST_LIMITS, formatSize } from '$lib/server/request-limits';
import { sanitizeFilename, isAllowedBackupExtension } from '$lib/server/validation';

export const _metadata = {
	POST: {
		summary: 'Restore database from backup',
		description:
			'Upload and restore the database from a backup file. Maximum file size is 500MB. The application should be restarted after a successful restore. Admin role required.',
		tags: ['Admin'],
		request: {
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
							file: z
								.any()
								.openapi({ description: 'SQLite database backup file (.db)', format: 'binary' })
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Database restored successfully',
				content: {
					'application/json': {
						schema: z.object({
							success: z.boolean(),
							message: z.string(),
							backup: z.object({
								filename: z.string(),
								sizeBytes: z.number(),
								createdAt: z.string(),
								encrypted: z.boolean()
							})
						})
					}
				}
			},
			400: {
				description: 'No file uploaded',
				content: { 'application/json': { schema: errorSchema } }
			},
			401: {
				description: 'Unauthorized',
				content: { 'application/json': { schema: errorSchema } }
			},
			403: {
				description: 'Admin role required',
				content: { 'application/json': { schema: errorSchema } }
			},
			413: {
				description: 'File too large (max 500MB)',
				content: { 'application/json': { schema: errorSchema } }
			},
			500: {
				description: 'Failed to restore backup',
				content: { 'application/json': { schema: errorSchema } }
			}
		}
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, { message: 'Unauthorized', code: 'Unauthorized' });
	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'admin', 'DatabaseBackup', undefined, clusterId);

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			throw error(400, { message: 'No file uploaded', code: 'BadRequest' });
		}

		// Validate file extension
		if (!isAllowedBackupExtension(file.name)) {
			throw error(400, {
				message: 'Invalid file type. Only .db and .db.enc files are accepted.',
				code: 'BadRequest'
			});
		}

		// Validate MIME type when provided (browsers may omit it or send
		// application/octet-stream — only reject clearly wrong types)
		const ALLOWED_MIME_PREFIXES = ['application/'];
		const mimeBase = file.type.split(';')[0].trim();
		if (mimeBase && !ALLOWED_MIME_PREFIXES.some((p) => mimeBase.startsWith(p))) {
			throw error(400, {
				message: 'Invalid content type. Expected a binary database file.',
				code: 'BadRequest'
			});
		}

		// Validate file size
		if (file.size > REQUEST_LIMITS.BACKUP_RESTORE) {
			throw error(413, {
				message: `File too large. Maximum size is ${formatSize(REQUEST_LIMITS.BACKUP_RESTORE)}, received ${formatSize(file.size)}`,
				code: 'PayloadTooLarge'
			});
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const result = await restoreFromBuffer(buffer);

		await logAudit(locals.user, 'backup:restore', {
			resourceType: 'DatabaseBackup',
			resourceName: sanitizeFilename(file.name),
			details: {
				uploadedSize: file.size,
				restoredSize: result.sizeBytes
			}
		});

		return json({
			success: true,
			message:
				'Database restored successfully. The application should be restarted for changes to take full effect.',
			backup: result
		});
	} catch (err) {
		const status =
			err !== null && typeof err === 'object' && 'status' in err
				? (err as { status: unknown }).status
				: undefined;
		if (typeof status === 'number' && status >= 400 && status < 500) {
			throw err;
		}
		logger.error(err, 'Failed to restore backup:');
		throw error(500, { message: 'Failed to restore backup', code: 'InternalServerError' });
	}
};
