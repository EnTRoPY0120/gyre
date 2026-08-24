import { describe, expect, test } from 'vitest';
import {
	filterAuditLogs,
	type AuditLogSearchItem
} from '../routes/admin/audit-logs/page-filters.js';

const logs: AuditLogSearchItem[] = [
	{
		action: 'login',
		resourceName: null,
		resourceType: null,
		namespace: null,
		ipAddress: '10.0.0.1',
		user: { username: 'alice' }
	},
	{
		action: 'cluster:update',
		resourceName: 'production',
		resourceType: 'Cluster',
		namespace: 'default',
		ipAddress: null,
		user: null
	}
];

describe('filterAuditLogs', () => {
	test('returns all logs for an empty query', () => {
		expect(filterAuditLogs(logs, '')).toBe(logs);
	});

	test('searches all displayed fields case-insensitively', () => {
		expect(filterAuditLogs(logs, 'ALICE')).toHaveLength(1);
		expect(filterAuditLogs(logs, 'PRODUCTION')).toHaveLength(1);
		expect(filterAuditLogs(logs, '10.0.0.1')).toHaveLength(1);
		expect(filterAuditLogs(logs, 'missing')).toEqual([]);
	});
});
