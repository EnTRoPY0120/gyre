/**
 * Admin Backup Restore API
 * POST /api/admin/backups/restore — Restore database from an uploaded backup file
 */

import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	restoreFromBuffer,
	getDecryptedBackupBufferFromBuffer,
	BackupError
} from '$lib/server/backup';
import {
	enforceUserRateLimitPreset,
	logPrivilegedMutationSuccess,
	requirePrivilegedAdminPermission
} from '$lib/server/http/guards.js';
import { REQUEST_LIMITS, formatSize } from '$lib/server/request-limits';
import {
	sanitizeFilename,
	isAllowedBackupExtension,
	isAllowedBackupMimeType
} from '$lib/server/validation';

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
							file: z.any().openapi({
								description: 'SQLite database backup file (.db or .db.enc)',
								format: 'binary'
							})
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

function requireBackupFile(formData: FormData): File {
	const file = formData.get('file');
	if (!file || !(file instanceof File)) {
		throw error(400, { message: 'No file uploaded', code: 'BadRequest' });
	}

	return file;
}

function validateBackupFile(file: File): void {
	if (!isAllowedBackupExtension(file.name)) {
		throw error(400, {
			message: 'Invalid file type. Only .db and .db.enc files are accepted.',
			code: 'BadRequest'
		});
	}

	// Browsers may omit the type or send application/octet-stream, but reject
	// content types that cannot represent a SQLite backup.
	if (!isAllowedBackupMimeType(file.type)) {
		throw error(400, {
			message: 'Invalid content type. Expected a binary database file.',
			code: 'BadRequest'
		});
	}

	if (file.size > REQUEST_LIMITS.BACKUP_RESTORE) {
		throw error(413, {
			message: `File too large. Maximum size is ${formatSize(REQUEST_LIMITS.BACKUP_RESTORE)}, received ${formatSize(file.size)}`,
			code: 'PayloadTooLarge'
		});
	}
}

async function restoreBackupFile(file: File) {
	const buffer = Buffer.from(await file.arrayBuffer());
	const restoreBuffer = getDecryptedBackupBufferFromBuffer(file.name, buffer);
	return await restoreFromBuffer(restoreBuffer);
}

async function writeRestoreAudit(
	user: Awaited<ReturnType<typeof requirePrivilegedAdminPermission>>,
	file: File,
	result: Awaited<ReturnType<typeof restoreFromBuffer>>
): Promise<void> {
	try {
		await logPrivilegedMutationSuccess({
			action: 'backup:restore',
			user,
			resourceType: 'DatabaseBackup',
			name: sanitizeFilename(file.name),
			details: {
				uploadedSize: file.size,
				restoredSize: result.sizeBytes
			}
		});
	} catch (auditErr) {
		logger.warn(auditErr, 'Failed to write backup restore audit event');
	}
}

function isClientError(errorValue: unknown): errorValue is { status: number } {
	if (errorValue === null || typeof errorValue !== 'object' || !('status' in errorValue)) {
		return false;
	}

	const status = (errorValue as { status: unknown }).status;
	return typeof status === 'number' && status >= 400 && status < 500;
}

function throwRestoreError(restoreError: unknown): never {
	if (restoreError instanceof BackupError) {
		logger.error(restoreError, 'Backup restore error:');
		const code = restoreError.status === 400 ? 'BadRequest' : 'InternalServerError';
		const message =
			code !== 'InternalServerError' ? restoreError.message : 'Failed to restore backup';
		throw error(restoreError.status, { message, code });
	}

	if (isClientError(restoreError)) {
		throw restoreError;
	}

	logger.error(restoreError, 'Failed to restore backup:');
	throw error(500, { message: 'Failed to restore backup', code: 'InternalServerError' });
}

export const POST: RequestHandler = async ({ locals, request, setHeaders }) => {
	const user = await requirePrivilegedAdminPermission(
		{ ...locals, cluster: undefined },
		'DatabaseBackup'
	);
	enforceUserRateLimitPreset({ setHeaders }, locals, 'admin');

	try {
		const file = requireBackupFile(await request.formData());
		validateBackupFile(file);
		const result = await restoreBackupFile(file);
		await writeRestoreAudit(user, file, result);

		return json({
			success: true,
			message:
				'Database restored successfully. The application should be restarted for changes to take full effect.',
			backup: result
		});
	} catch (err) {
		throwRestoreError(err);
	}
};
