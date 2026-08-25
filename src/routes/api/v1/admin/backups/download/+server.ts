/**
 * Admin Backup Download API
 * GET /api/admin/backups/download?filename=... — Download a specific backup
 *
 * Encrypted backups (.db.enc) are transparently decrypted before download
 * so the returned file is always a plain SQLite database.
 *
 * Unencrypted backups (.db) are streamed directly for memory efficiency.
 * Encrypted backups must be fully buffered because AES-GCM auth tag
 * verification requires the complete ciphertext before any plaintext is safe
 * to return.
 */

import { logger } from '$lib/server/logger.js';
import { error } from '@sveltejs/kit';
import { z, errorSchema } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	getDecryptedBackupBuffer,
	getBackupPath,
	BackupError,
	BACKUP_FILENAME_RE
} from '$lib/server/backup';
import {
	logPrivilegedMutationFailure,
	logPrivilegedMutationSuccess,
	requirePrivilegedAdminPermission
} from '$lib/server/http/guards.js';
import { createReadStream, statSync } from 'node:fs';
import { basename } from 'node:path';

const BACKUP_STATUS_CODES: Record<number, string> = {
	400: 'BadRequest',
	404: 'NotFound',
	500: 'InternalServerError'
};

function downloadHeaders(filename: string, size: number): HeadersInit {
	const safeFilename = filename.replace(/["\\\r\n]/g, '');
	return {
		'Content-Type': 'application/x-sqlite3',
		'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
		'Content-Length': String(size)
	};
}

function createEncryptedDownloadResponse(filename: string): Response {
	const buffer = getDecryptedBackupBuffer(filename);
	if (!buffer) throw error(404, { message: 'Backup not found', code: 'NotFound' });

	const safeFilename = filename.replace(/\.enc$/, '');
	return new Response(buffer as unknown as BodyInit, {
		status: 200,
		headers: downloadHeaders(safeFilename, buffer.byteLength)
	});
}

function createPlainDownloadResponse(filename: string): Response {
	const filePath = getBackupPath(filename);
	if (!filePath) throw error(404, { message: 'Backup not found', code: 'NotFound' });

	const stat = statSync(filePath);
	const stream = createReadStream(filePath);
	const safeFilename = basename(filePath);
	return new Response(stream as unknown as ReadableStream, {
		status: 200,
		headers: downloadHeaders(safeFilename, stat.size)
	});
}

function createDownloadResponse(filename: string): Response {
	return filename.endsWith('.db.enc')
		? createEncryptedDownloadResponse(filename)
		: createPlainDownloadResponse(filename);
}

export const _metadata = {
	GET: {
		summary: 'Download database backup',
		description:
			'Download a specific database backup file as a SQLite binary. Encrypted backups are decrypted before download. Admin permission required.',
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
			500: {
				description: 'Failed to download backup',
				content: { 'application/json': { schema: errorSchema } }
			}
		}
	}
};

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await requirePrivilegedAdminPermission(
		{ ...locals, cluster: undefined },
		'DatabaseBackup'
	);

	const rawFilename = url.searchParams.get('filename');
	if (!rawFilename) {
		throw error(400, { message: 'Missing filename parameter', code: 'BadRequest' });
	}

	const filename = basename(rawFilename);
	if (!BACKUP_FILENAME_RE.test(filename)) {
		throw error(400, { message: 'Invalid backup filename', code: 'BadRequest' });
	}

	try {
		const response = createDownloadResponse(filename);
		await logPrivilegedMutationSuccess({
			action: 'backup:download',
			user,
			resourceType: 'DatabaseBackup',
			name: filename
		});
		return response;
	} catch (err) {
		await logPrivilegedMutationFailure({
			action: 'backup:download',
			user,
			resourceType: 'DatabaseBackup',
			name: filename,
			error: err
		});

		if (err instanceof BackupError) {
			logger.error(err, 'Backup download error:');
			const code = BACKUP_STATUS_CODES[err.status] ?? 'InternalServerError';
			const message = code !== 'InternalServerError' ? err.message : 'Failed to download backup';
			throw error(err.status, { message, code });
		}
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		logger.error(err, 'Failed to download backup:');
		throw error(500, { message: 'Failed to download backup', code: 'InternalServerError' });
	}
};
