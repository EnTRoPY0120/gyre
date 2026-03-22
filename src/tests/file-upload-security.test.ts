/**
 * Security-focused tests for file upload validation.
 *
 * Covers sanitizeFilename, isAllowedBackupExtension, and the kubeconfig
 * kind/apiVersion check added in GH #286.
 */
import { describe, test, expect } from 'bun:test';
import {
	sanitizeFilename,
	isAllowedBackupExtension,
	isAllowedBackupMimeType
} from '../lib/server/validation.js';

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
	test('strips newline characters', () => {
		expect(sanitizeFilename('backup\n.db')).toBe('backup.db');
	});

	test('strips carriage return characters', () => {
		expect(sanitizeFilename('backup\r.db')).toBe('backup.db');
	});

	test('strips null bytes', () => {
		expect(sanitizeFilename('backup\x00.db')).toBe('backup.db');
	});

	test('strips all control characters (\\x00-\\x1f)', () => {
		const allControls = Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join('');
		expect(sanitizeFilename(allControls + 'safe')).toBe('safe');
	});

	test('strips DEL character (\\x7f)', () => {
		expect(sanitizeFilename('file\x7fname.db')).toBe('filename.db');
	});

	test('passes safe filenames unchanged', () => {
		expect(sanitizeFilename('gyre-backup-2026-03-18.db')).toBe('gyre-backup-2026-03-18.db');
	});

	test('passes filenames with dots, dashes, underscores unchanged', () => {
		expect(sanitizeFilename('my_backup.db.enc')).toBe('my_backup.db.enc');
	});

	test('truncates to 255 characters', () => {
		const long = 'a'.repeat(300);
		expect(sanitizeFilename(long).length).toBe(255);
	});

	test('does not truncate names at or below 255 chars', () => {
		const exact = 'a'.repeat(255);
		expect(sanitizeFilename(exact)).toBe(exact);
	});
});

// ---------------------------------------------------------------------------
// isAllowedBackupExtension
// ---------------------------------------------------------------------------

describe('isAllowedBackupExtension', () => {
	test('accepts .db extension', () => {
		expect(isAllowedBackupExtension('gyre-backup.db')).toBe(true);
	});

	test('accepts .db.enc extension', () => {
		expect(isAllowedBackupExtension('gyre-backup.db.enc')).toBe(true);
	});

	test('rejects .exe', () => {
		expect(isAllowedBackupExtension('malicious.exe')).toBe(false);
	});

	test('rejects .sh', () => {
		expect(isAllowedBackupExtension('script.sh')).toBe(false);
	});

	test('rejects .db.bak (double extension trick)', () => {
		expect(isAllowedBackupExtension('backup.db.bak')).toBe(false);
	});

	test('rejects .sqlite', () => {
		expect(isAllowedBackupExtension('backup.sqlite')).toBe(false);
	});

	test('rejects no extension', () => {
		expect(isAllowedBackupExtension('backup')).toBe(false);
	});

	test('rejects .DB (case sensitive)', () => {
		expect(isAllowedBackupExtension('backup.DB')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isAllowedBackupMimeType
// ---------------------------------------------------------------------------

describe('isAllowedBackupMimeType', () => {
	test('accepts application/octet-stream', () => {
		expect(isAllowedBackupMimeType('application/octet-stream')).toBe(true);
	});

	test('accepts application/x-sqlite3', () => {
		expect(isAllowedBackupMimeType('application/x-sqlite3')).toBe(true);
	});

	test('accepts empty string (browser-omitted MIME type)', () => {
		expect(isAllowedBackupMimeType('')).toBe(true);
	});

	test('strips semicolon parameters before matching', () => {
		expect(isAllowedBackupMimeType('application/octet-stream; charset=utf-8')).toBe(true);
	});

	test('rejects application/zip', () => {
		expect(isAllowedBackupMimeType('application/zip')).toBe(false);
	});

	test('rejects application/x-executable', () => {
		expect(isAllowedBackupMimeType('application/x-executable')).toBe(false);
	});

	test('rejects application/javascript', () => {
		expect(isAllowedBackupMimeType('application/javascript')).toBe(false);
	});

	test('rejects text/plain', () => {
		expect(isAllowedBackupMimeType('text/plain')).toBe(false);
	});

	test('rejects image/png', () => {
		expect(isAllowedBackupMimeType('image/png')).toBe(false);
	});

	test('rejects whitespace-only MIME string', () => {
		expect(isAllowedBackupMimeType('   ')).toBe(false);
	});

	test('accepts mixed-case MIME type (case-insensitive per RFC 2045)', () => {
		expect(isAllowedBackupMimeType('Application/Octet-Stream')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Kubeconfig kind/apiVersion validation logic (mirrors +page.server.ts check)
// ---------------------------------------------------------------------------

describe('kubeconfig kind/apiVersion validation', () => {
	// Inline the check from the route so we can test it without SvelteKit infra
	function isValidKubeconfigStructure(parsed: unknown): boolean {
		if (parsed === null || parsed === undefined || typeof parsed !== 'object') return false;
		const config = parsed as Record<string, unknown>;
		if (!config.clusters || !config.contexts) return false;
		if (config.kind !== 'Config' || config.apiVersion !== 'v1') return false;
		if (!Array.isArray(config.clusters) || !Array.isArray(config.contexts)) return false;
		return true;
	}

	test('accepts a valid kubeconfig object', () => {
		expect(
			isValidKubeconfigStructure({
				apiVersion: 'v1',
				kind: 'Config',
				clusters: [{}],
				contexts: [{}]
			})
		).toBe(true);
	});

	test('rejects missing kind', () => {
		expect(
			isValidKubeconfigStructure({
				apiVersion: 'v1',
				clusters: [{}],
				contexts: [{}]
			})
		).toBe(false);
	});

	test('rejects missing apiVersion', () => {
		expect(
			isValidKubeconfigStructure({
				kind: 'Config',
				clusters: [{}],
				contexts: [{}]
			})
		).toBe(false);
	});

	test('rejects wrong kind', () => {
		expect(
			isValidKubeconfigStructure({
				apiVersion: 'v1',
				kind: 'Secret',
				clusters: [{}],
				contexts: [{}]
			})
		).toBe(false);
	});

	test('rejects wrong apiVersion', () => {
		expect(
			isValidKubeconfigStructure({
				apiVersion: 'apps/v1',
				kind: 'Config',
				clusters: [{}],
				contexts: [{}]
			})
		).toBe(false);
	});

	test('rejects arbitrary JSON with clusters and contexts keys but no kind/apiVersion', () => {
		expect(
			isValidKubeconfigStructure({
				clusters: ['a', 'b'],
				contexts: ['c'],
				data: 'anything goes'
			})
		).toBe(false);
	});

	test('rejects clusters as a non-array truthy value', () => {
		expect(
			isValidKubeconfigStructure({
				apiVersion: 'v1',
				kind: 'Config',
				clusters: 'not-an-array',
				contexts: [{}]
			})
		).toBe(false);
	});

	test('rejects contexts as a non-array truthy value', () => {
		expect(
			isValidKubeconfigStructure({
				apiVersion: 'v1',
				kind: 'Config',
				clusters: [{}],
				contexts: { 0: {} }
			})
		).toBe(false);
	});

	test('rejects null', () => {
		expect(isValidKubeconfigStructure(null)).toBe(false);
	});

	test('rejects a plain string', () => {
		expect(isValidKubeconfigStructure('not an object')).toBe(false);
	});
});
