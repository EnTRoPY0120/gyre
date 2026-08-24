import { describe, expect, test } from 'vitest';
import {
	parseAuditLogDetails,
	parseAuditLogPageQuery
} from '../routes/admin/audit-logs/page-helpers.js';

describe('audit log page helpers', () => {
	test('uses safe defaults for missing and invalid query values', () => {
		expect(parseAuditLogPageQuery(new URL('http://localhost/admin/audit-logs'))).toEqual({
			userId: undefined,
			action: undefined,
			success: undefined,
			limit: 50,
			offset: 0,
			sortBy: 'date',
			sortOrder: 'desc',
			successFilter: 'all'
		});
		expect(
			parseAuditLogPageQuery(
				new URL('http://localhost/admin/audit-logs?limit=999&offset=-1&sortBy=nope&success=maybe')
			)
		).toMatchObject({ limit: 200, offset: 0, sortBy: 'date', successFilter: 'all' });
	});

	test('preserves accepted filters and sort values', () => {
		expect(
			parseAuditLogPageQuery(
				new URL(
					'http://localhost/admin/audit-logs?limit=25&offset=50&sortBy=action&sortOrder=asc&success=false&action=login&userId=user-1'
				)
			)
		).toEqual({
			userId: 'user-1',
			action: 'login',
			success: false,
			limit: 25,
			offset: 50,
			sortBy: 'action',
			sortOrder: 'asc',
			successFilter: 'false'
		});
	});

	test('parses valid details and preserves malformed details safely', () => {
		expect(parseAuditLogDetails('{"success":true}', 'log-1')).toEqual({ success: true });
		expect(parseAuditLogDetails('{', 'log-2')).toEqual({ raw: '{', error: 'Failed to parse JSON' });
		expect(parseAuditLogDetails(null, 'log-3')).toBeNull();
	});
});
