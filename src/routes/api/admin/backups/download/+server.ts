/**
 * Admin Backup Download API
 * GET /api/admin/backups/download?filename=... — Download a specific backup
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBackupPath } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';
import { readFileSync } from 'node:fs';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const filename = url.searchParams.get('filename');
	if (!filename) {
		throw error(400, { message: 'Missing filename parameter' });
	}

	const filePath = getBackupPath(filename);
	if (!filePath) {
		throw error(404, { message: 'Backup not found' });
	}

	try {
		const fileBuffer = readFileSync(filePath);

		await logAudit(locals.user, 'backup:download', {
			resourceType: 'DatabaseBackup',
			resourceName: filename
		});

		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': String(fileBuffer.length)
			}
		});
	} catch (err) {
		console.error('Failed to download backup:', err);
		throw error(500, { message: 'Failed to download backup' });
	}
};
