import { describe, expect, test, vi } from 'vitest';
import {
	executePrivilegedDelete,
	isPermissionDeniedError
} from '../routes/api/v1/flux/[resourceType]/[namespace]/[name]/delete-route-helpers.js';

describe('Flux delete route helpers', () => {
	test('recognizes only HTTP 403 permission errors', () => {
		expect(isPermissionDeniedError({ status: 403 })).toBe(true);
		expect(isPermissionDeniedError({ status: 401 })).toBe(false);
		expect(isPermissionDeniedError(new Error('forbidden'))).toBe(false);
	});

	test('audits permission failures and skips deletion', async () => {
		const permissionError = { status: 403, message: 'forbidden' };
		const deleteResource = vi.fn<() => Promise<void>>();
		const logFailure = vi.fn<(error: unknown) => Promise<void>>().mockResolvedValue(undefined);

		await expect(
			executePrivilegedDelete({
				requirePermission: vi.fn().mockRejectedValue(permissionError),
				deleteResource,
				logFailure,
				logSuccess: vi.fn().mockResolvedValue(undefined),
				mapError: vi.fn()
			})
		).rejects.toBe(permissionError);

		expect(deleteResource).not.toHaveBeenCalled();
		expect(logFailure).toHaveBeenCalledWith('Permission denied');
	});

	test('audits successful deletion after the delete completes', async () => {
		const events: string[] = [];

		await executePrivilegedDelete({
			requirePermission: async () => events.push('permission'),
			deleteResource: async () => events.push('delete'),
			logFailure: async () => events.push('failure'),
			logSuccess: async () => events.push('success'),
			mapError: (error) => error
		});

		expect(events).toEqual(['permission', 'delete', 'success']);
	});

	test('audits and maps deletion failures', async () => {
		const deleteError = new Error('not found');
		const mappedError = new Error('mapped');
		const logFailure = vi.fn<(error: unknown) => Promise<void>>().mockResolvedValue(undefined);

		await expect(
			executePrivilegedDelete({
				requirePermission: vi.fn().mockResolvedValue(undefined),
				deleteResource: vi.fn().mockRejectedValue(deleteError),
				logFailure,
				logSuccess: vi.fn().mockResolvedValue(undefined),
				mapError: (error) => {
					expect(error).toBe(deleteError);
					return mappedError;
				}
			})
		).rejects.toBe(mappedError);

		expect(logFailure).toHaveBeenCalledWith(deleteError);
	});
});
