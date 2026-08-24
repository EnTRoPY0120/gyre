import { describe, expect, test } from 'vitest';
import { buildAuditLogQuery } from '../lib/server/audit-query.js';

describe('buildAuditLogQuery', () => {
	test('uses stable defaults for an unfiltered date query', () => {
		const query = buildAuditLogQuery({});
		expect(query.whereClause).toBeUndefined();
		expect(query.orderBy).toHaveLength(1);
		expect(query.limit).toBe(50);
		expect(query.offset).toBe(0);
	});

	test('combines filters and action sorting', () => {
		const query = buildAuditLogQuery({
			userId: 'user-1',
			action: 'login',
			success: false,
			limit: 10,
			offset: 20,
			sortBy: 'action',
			sortOrder: 'asc'
		});

		expect(query.whereClause).toBeDefined();
		expect(query.orderBy).toHaveLength(2);
		expect(query.limit).toBe(10);
		expect(query.offset).toBe(20);
	});
});
