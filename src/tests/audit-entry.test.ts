import { describe, expect, test } from 'vitest';
import { buildAuditLogEntry } from '../lib/server/audit.js';

describe('buildAuditLogEntry', () => {
	test('builds a default anonymous successful entry', () => {
		expect(buildAuditLogEntry(null, 'login')).toMatchObject({
			userId: null,
			action: 'login',
			success: true,
			resourceType: null,
			details: null,
			ipAddress: null
		});
	});

	test('preserves identity and optional metadata', () => {
		const entry = buildAuditLogEntry({ id: 'user-1' } as never, 'cluster:update', {
			resourceType: 'Cluster',
			resourceName: 'production',
			namespace: 'default',
			clusterId: 'cluster-1',
			success: false,
			ipAddress: '127.0.0.1'
		});

		expect(entry).toMatchObject({
			userId: 'user-1',
			resourceType: 'Cluster',
			resourceName: 'production',
			namespace: 'default',
			clusterId: 'cluster-1',
			success: false,
			ipAddress: '127.0.0.1'
		});
	});

	test('redacts nested sensitive details before serialization', () => {
		const entry = buildAuditLogEntry(null, 'settings:update', {
			details: { settings: { clientSecret: 'hidden', theme: 'dark' } }
		});

		expect(JSON.parse(entry.details ?? '{}')).toEqual({
			settings: { clientSecret: '[REDACTED]', theme: 'dark' }
		});
	});
});
