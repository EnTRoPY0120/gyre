import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as actualFs from 'node:fs';
import { Readable } from 'node:stream';
import * as actualRequestLimits from '../lib/server/request-limits.js';
import { importFresh } from './helpers/import-fresh';
import { createLoggerModuleStub, createRbacModuleStub } from './helpers/module-stubs';

type DownloadRouteModule = typeof import('../routes/api/v1/admin/backups/download/+server.js');
type RestoreRouteModule = typeof import('../routes/api/v1/admin/backups/restore/+server.js');

const BACKUP_FILENAME_RE = /^gyre-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db(\.enc)?$/;

class StubBackupError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
		this.name = 'BackupError';
	}
}

let decryptedDownloadBuffer: Buffer | null = null;
let decryptedUploadBuffer: Buffer | null = null;
let restoreResult = {
	filename: 'gyre-backup-2026-04-24T10-30-00-000Z.db',
	sizeBytes: 42,
	createdAt: '2026-04-24T10:30:00.000Z',
	encrypted: false
};
let downloadError: StubBackupError | null = null;
let restoreError: StubBackupError | null = null;
let backupRestoreLimit = 1024;

const plainDownloadBody = Buffer.from('plain-backup');
const getBackupPathCalls: string[] = [];
const getDecryptedBackupBufferCalls: string[] = [];
const getDecryptedUploadCalls: Array<{ filename: string; size: number }> = [];
const restoreCalls: Buffer[] = [];
const auditCalls: Array<{ action: string; resourceName?: string }> = [];

let downloadGET: DownloadRouteModule['GET'];
let restorePOST: RestoreRouteModule['POST'];

function createRequestLimitsModuleStub() {
	const requestLimits = {
		...actualRequestLimits.REQUEST_LIMITS
	};
	Object.defineProperty(requestLimits, 'BACKUP_RESTORE', {
		configurable: true,
		enumerable: true,
		get: () => backupRestoreLimit
	});

	return {
		...actualRequestLimits,
		REQUEST_LIMITS: requestLimits,
		formatSize: (size: number) => `${size}B`,
		getRequestSizeLimit: (path: string, method: string) => {
			if (path === '/api/v1/admin/backups/restore' && method === 'POST') {
				return backupRestoreLimit;
			}
			return actualRequestLimits.getRequestSizeLimit(path, method);
		}
	};
}

function createDownloadEvent(filename: string | null) {
	const url = new URL('http://localhost/api/v1/admin/backups/download');
	if (filename !== null) {
		url.searchParams.set('filename', filename);
	}

	return {
		locals: {
			cluster: 'cluster-a',
			user: { id: 'user-1', role: 'admin' }
		},
		url
	} as Parameters<DownloadRouteModule['GET']>[0];
}

function createRestoreEvent(file: File | null) {
	const formData = new FormData();
	if (file) {
		formData.set('file', file);
	}

	return {
		locals: {
			cluster: 'cluster-a',
			user: { id: 'user-1', role: 'admin' }
		},
		request: new Request('http://localhost/api/v1/admin/backups/restore', {
			body: formData,
			method: 'POST'
		})
	} as Parameters<RestoreRouteModule['POST']>[0];
}

beforeEach(async () => {
	decryptedDownloadBuffer = null;
	decryptedUploadBuffer = null;
	restoreResult = {
		filename: 'gyre-backup-2026-04-24T10-30-00-000Z.db',
		sizeBytes: 42,
		createdAt: '2026-04-24T10:30:00.000Z',
		encrypted: false
	};
	downloadError = null;
	restoreError = null;
	backupRestoreLimit = 1024;
	getBackupPathCalls.length = 0;
	getDecryptedBackupBufferCalls.length = 0;
	getDecryptedUploadCalls.length = 0;
	restoreCalls.length = 0;
	auditCalls.length = 0;

	mock.module('$lib/server/logger.js', () => createLoggerModuleStub());
	mock.module('$lib/server/rbac', () => createRbacModuleStub());
	const auditModuleStub = {
		logAudit: async (_user: unknown, action: string, details: { resourceName?: string } = {}) => {
			auditCalls.push({ action, resourceName: details.resourceName });
		},
		logLogin: async () => {},
		logLogout: async () => {}
	};
	mock.module('$lib/server/audit', () => auditModuleStub);
	mock.module('$lib/server/audit.js', () => auditModuleStub);
	const requestLimitsModuleStub = createRequestLimitsModuleStub();
	mock.module('$lib/server/request-limits', () => requestLimitsModuleStub);
	mock.module('$lib/server/request-limits.js', () => requestLimitsModuleStub);
	mock.module('$lib/server/backup', () => ({
		BACKUP_FILENAME_RE,
		BackupError: StubBackupError,
		getBackupPath: (filename: string) => {
			getBackupPathCalls.push(filename);
			if (downloadError) {
				throw downloadError;
			}
			return `/tmp/${filename}`;
		},
		getDecryptedBackupBuffer: (filename: string) => {
			getDecryptedBackupBufferCalls.push(filename);
			if (downloadError) {
				throw downloadError;
			}
			return decryptedDownloadBuffer;
		},
		getDecryptedBackupBufferFromBuffer: (filename: string, buffer: Buffer) => {
			getDecryptedUploadCalls.push({ filename, size: buffer.byteLength });
			if (filename.endsWith('.enc') && decryptedUploadBuffer) {
				return decryptedUploadBuffer;
			}
			return buffer;
		},
		restoreFromBuffer: async (buffer: Buffer) => {
			restoreCalls.push(buffer);
			if (restoreError) {
				throw restoreError;
			}
			return restoreResult;
		}
	}));
	mock.module('node:fs', () => ({
		...actualFs,
		createReadStream: () => Readable.from([plainDownloadBody]),
		statSync: () => ({ size: plainDownloadBody.byteLength })
	}));

	downloadGET = (
		await importFresh<DownloadRouteModule>('../routes/api/v1/admin/backups/download/+server.js')
	).GET;
	restorePOST = (
		await importFresh<RestoreRouteModule>('../routes/api/v1/admin/backups/restore/+server.js')
	).POST;
});

afterEach(() => {
	mock.restore();
});

describe('backup route behavior', () => {
	test('downloads plain .db backups with the expected headers', async () => {
		const filename = 'gyre-backup-2026-04-24T10-30-00-000Z.db';
		const response = await downloadGET(createDownloadEvent(filename));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/x-sqlite3');
		expect(response.headers.get('content-length')).toBe(String(plainDownloadBody.byteLength));
		expect(response.headers.get('content-disposition')).toContain(`filename="${filename}"`);
		expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('plain-backup');
		expect(getBackupPathCalls).toEqual([filename]);
		expect(getDecryptedBackupBufferCalls).toEqual([]);
		expect(auditCalls).toEqual([{ action: 'backup:download', resourceName: filename }]);
	});

	test('downloads encrypted backups after transparent decryption and strips .enc from the filename', async () => {
		const filename = 'gyre-backup-2026-04-24T10-30-00-000Z.db.enc';
		decryptedDownloadBuffer = Buffer.from('decrypted-backup');

		const response = await downloadGET(createDownloadEvent(filename));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-disposition')).toContain(
			'filename="gyre-backup-2026-04-24T10-30-00-000Z.db"'
		);
		expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('decrypted-backup');
		expect(getBackupPathCalls).toEqual([]);
		expect(getDecryptedBackupBufferCalls).toEqual([filename]);
	});

	test('rejects missing or invalid download filenames', async () => {
		await expect(downloadGET(createDownloadEvent(null))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Missing filename parameter', code: 'BadRequest' }
		});

		await expect(downloadGET(createDownloadEvent('../escape.db'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid backup filename', code: 'BadRequest' }
		});
	});

	test('restores uploaded .db and .db.enc backups successfully', async () => {
		const plainFile = new File(
			[Buffer.from('plain-db')],
			'gyre-backup-2026-04-24T10-30-00-000Z.db',
			{
				type: 'application/octet-stream'
			}
		);
		const encryptedFile = new File(
			[Buffer.from('encrypted-db')],
			'gyre-backup-2026-04-24T10-30-01-000Z.db.enc',
			{ type: 'application/octet-stream' }
		);
		decryptedUploadBuffer = Buffer.from('decrypted-upload');

		const plainResponse = await restorePOST(createRestoreEvent(plainFile));
		expect(plainResponse.status).toBe(200);
		expect(await plainResponse.json()).toEqual({
			success: true,
			message:
				'Database restored successfully. The application should be restarted for changes to take full effect.',
			backup: restoreResult
		});

		const encryptedResponse = await restorePOST(createRestoreEvent(encryptedFile));
		expect(encryptedResponse.status).toBe(200);
		expect(await encryptedResponse.json()).toEqual({
			success: true,
			message:
				'Database restored successfully. The application should be restarted for changes to take full effect.',
			backup: restoreResult
		});

		expect(getDecryptedUploadCalls).toEqual([
			{ filename: plainFile.name, size: plainFile.size },
			{ filename: encryptedFile.name, size: encryptedFile.size }
		]);
		expect(restoreCalls.map((buffer) => buffer.toString())).toEqual([
			'plain-db',
			'decrypted-upload'
		]);
		expect(auditCalls).toEqual([
			{ action: 'backup:restore', resourceName: plainFile.name },
			{ action: 'backup:restore', resourceName: encryptedFile.name }
		]);
	});

	test('rejects invalid restore extensions and MIME types', async () => {
		const wrongExtension = new File([Buffer.from('abc')], 'backup.txt', {
			type: 'application/octet-stream'
		});
		const wrongMime = new File([Buffer.from('abc')], 'backup.db', {
			type: 'text/plain'
		});

		await expect(restorePOST(createRestoreEvent(wrongExtension))).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'Invalid file type. Only .db and .db.enc files are accepted.',
				code: 'BadRequest'
			}
		});

		await expect(
			restorePOST({
				locals: {
					cluster: 'cluster-a',
					user: { id: 'user-1', role: 'admin' }
				},
				request: {
					formData: async () => {
						const formData = new FormData();
						formData.set('file', wrongMime);
						return formData;
					}
				}
			} as Parameters<RestoreRouteModule['POST']>[0])
		).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'Invalid content type. Expected a binary database file.',
				code: 'BadRequest'
			}
		});
		expect(restoreCalls).toEqual([]);
	});

	test('rejects uploads that exceed the configured restore limit', async () => {
		backupRestoreLimit = 5;
		const oversizedFile = new File([Buffer.from('123456')], 'backup.db', {
			type: 'application/octet-stream'
		});

		await expect(restorePOST(createRestoreEvent(oversizedFile))).rejects.toMatchObject({
			status: 413,
			body: {
				message: 'File too large. Maximum size is 5B, received 6B',
				code: 'PayloadTooLarge'
			}
		});
		expect(restoreCalls).toEqual([]);
	});

	test('maps BackupError responses for both download and restore routes', async () => {
		downloadError = new StubBackupError('Backup not found', 404);
		await expect(
			downloadGET(createDownloadEvent('gyre-backup-2026-04-24T10-30-00-000Z.db.enc'))
		).rejects.toMatchObject({
			status: 404,
			body: { message: 'Backup not found', code: 'NotFound' }
		});

		restoreError = new StubBackupError('Restore payload is corrupt', 400);
		const restoreFile = new File([Buffer.from('db')], 'backup.db', {
			type: 'application/octet-stream'
		});
		await expect(restorePOST(createRestoreEvent(restoreFile))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Restore payload is corrupt', code: 'BadRequest' }
		});
	});
});
