/**
 * Admin Backup Download API
 * GET /api/admin/backups/download?filename=... — Download a specific backup
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBackupPath } from '$lib/server/backup';
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/rbac';
import { createReadStream, statSync } from 'node:fs';

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

	const filePath = getBackupPath(filename);
	if (!filePath) {
		throw error(404, 'Backup not found');
	}

	try {
		const stat = statSync(filePath);
		const stream = createReadStream(filePath);

		await logAudit(locals.user, 'backup:download', {
			resourceType: 'DatabaseBackup',
			resourceName: filename
		});

		return new Response(stream as any, {
			status: 200,
			headers: {
				'Content-Type': 'application/x-sqlite3',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': String(stat.size)
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to download backup:', err);
		throw error(500, 'Failed to download backup');
	}
};
