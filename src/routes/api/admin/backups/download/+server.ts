/**
 * Admin Backup Download API
 * GET /api/admin/backups/download?filename=... — Download a specific backup
 *
 * Encrypted backups (.db.enc) are transparently decrypted before download
 * so the returned file is always a plain SQLite database.
 */

import { error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { getDecryptedBackupBuffer, BackupError } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/rbac';
import { basename } from 'node:path';

export const _metadata = {
	GET: {
		summary: 'Download database backup',
		description:
			'Download a specific database backup file as a SQLite binary. Encrypted backups are decrypted before download. Read permission required.',
		tags: ['Admin'],
		request: {
			query: z.object({
				filename: z.string().openapi({
					example: 'gyre-backup-2024-01-15T10-30-00.db',
					description: 'Backup filename to download'
				})
			})
		},
		responses: {
			200: {
				description: 'SQLite database file download',
				content: { 'application/x-sqlite3': { schema: z.any() } }
			},
			400: { description: 'Missing filename parameter' },
			401: { description: 'Unauthorized' },
			403: { description: 'Permission denied' },
			404: { description: 'Backup not found' },
			500: { description: 'Failed to decrypt backup' }
		}
	}
};

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const clusterId = locals.cluster || 'in-cluster';
	await requirePermission(locals.user, 'read', 'DatabaseBackup', undefined, clusterId);

	const filename = url.searchParams.get('filename');
	if (!filename) {
		throw error(400, 'Missing filename parameter');
	}

	try {
		const buffer = getDecryptedBackupBuffer(filename);
		if (!buffer) {
			throw error(404, 'Backup not found');
		}

		// Always serve as .db regardless of whether the source was encrypted
		const safeFilename = basename(filename).replace(/\.enc$/, '');

		await logAudit(locals.user, 'backup:download', {
			resourceType: 'DatabaseBackup',
			resourceName: basename(filename)
		});

		return new Response(buffer.buffer as ArrayBuffer, {
			status: 200,
			headers: {
				'Content-Type': 'application/x-sqlite3',
				'Content-Disposition': `attachment; filename="${safeFilename}"`,
				'Content-Length': String(buffer.byteLength)
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		if (err instanceof BackupError) {
			throw error(err.status, err.message);
		}
		console.error('Failed to download backup:', err);
		throw error(500, 'Failed to download backup');
	}
};
