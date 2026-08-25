import { describe, expect, test } from 'vitest';
import {
	getResourceListLoadError,
	parseResourceListQuery
} from '../routes/resources/[type]/resource-list-load.js';

describe('parseResourceListQuery', () => {
	test('parses valid sort and pagination values', () => {
		expect(
			parseResourceListQuery(
				new URL(
					'http://localhost/resources/gitrepositories?sortBy=age&sortOrder=desc&limit=25&offset=50'
				)
			)
		).toEqual({ limit: 25, offset: 50, sortBy: 'age', sortOrder: 'desc' });
	});

	test('uses safe defaults for invalid query values', () => {
		expect(
			parseResourceListQuery(
				new URL(
					'http://localhost/resources/gitrepositories?sortBy=bad&sortOrder=sideways&limit=0&offset=-1'
				)
			)
		).toEqual({ limit: undefined, offset: undefined, sortBy: undefined, sortOrder: 'asc' });
	});
});

describe('getResourceListLoadError', () => {
	test('keeps not-found resources empty without showing an error', () => {
		expect(getResourceListLoadError({ status: 404 })).toBeNull();
	});

	test('prefers API messages and has stable generic fallbacks', () => {
		expect(
			getResourceListLoadError({ status: 500, body: { message: 'Cluster unavailable' } })
		).toBe('Cluster unavailable');
		expect(getResourceListLoadError({ status: 503 })).toBe('Failed to fetch resources: 503');
		expect(getResourceListLoadError(new Error('network'))).toBe('Failed to connect to the API');
	});
});
