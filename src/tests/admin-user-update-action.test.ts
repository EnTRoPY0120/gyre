import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';

type UsersPageModule = typeof import('../routes/admin/users/+page.server.js');

const updateUser = vi.fn();
const logUserManagement = vi.fn();
let updateAction: UsersPageModule['actions']['update'];

const admin = { id: 'admin-1', username: 'admin', role: 'admin' } as User;

beforeEach(async () => {
	updateUser.mockReset().mockResolvedValue({ id: 'target-1', username: 'target' });
	logUserManagement.mockReset().mockResolvedValue(undefined);
	vi.doMock('$lib/server/rbac', () => ({ isAdmin: (user: User | null) => user?.role === 'admin' }));
	vi.doMock('$lib/server/auth', () => ({
		listUsersPaginated: vi.fn(),
		updateUser,
		deleteUser: vi.fn()
	}));
	vi.doMock('$lib/server/audit', () => ({ logUserManagement }));
	vi.doMock('../routes/admin/users/create-user', () => ({ createUserAndLog: vi.fn() }));
	vi.doMock('../routes/admin/users/reset-password', () => ({ resetPasswordAction: vi.fn() }));
	const module = await importFresh<UsersPageModule>('../routes/admin/users/+page.server.js');
	updateAction = module.actions.update;
});

afterEach(() => {
	vi.doUnmock('$lib/server/rbac');
	vi.doUnmock('$lib/server/auth');
	vi.doUnmock('$lib/server/audit');
	vi.doUnmock('../routes/admin/users/create-user');
	vi.doUnmock('../routes/admin/users/reset-password');
	vi.resetModules();
});

function submit(formData: FormData, userId = 'target-1') {
	if (!formData.has('userId')) formData.set('userId', userId);
	return updateAction({
		locals: { user: admin },
		request: new Request('http://localhost/admin/users?/update', {
			method: 'POST',
			body: formData
		})
	} as Parameters<UsersPageModule['actions']['update']>[0]);
}

describe('admin user update action input validation', () => {
	test.each([
		['unsupported role', (formData: FormData) => formData.set('role', 'owner')],
		['numeric active flag', (formData: FormData) => formData.set('active', '0')],
		['role upload', (formData: FormData) => formData.set('role', new File(['admin'], 'role.txt'))],
		[
			'active upload',
			(formData: FormData) => formData.set('active', new File(['true'], 'active.txt'))
		]
	])('rejects %s before persistence', async (_name, addInvalidField) => {
		const formData = new FormData();
		addInvalidField(formData);

		await expect(submit(formData)).resolves.toMatchObject({
			status: 400,
			data: { error: expect.any(String) }
		});
		expect(updateUser).not.toHaveBeenCalled();
		expect(logUserManagement).not.toHaveBeenCalled();
	});

	test('updates each allowed role and both explicit active values', async () => {
		for (const role of ['admin', 'editor', 'viewer'] as const) {
			const formData = new FormData();
			formData.set('role', role);
			formData.set('active', 'true');
			await expect(submit(formData)).resolves.toMatchObject({ success: true });
			expect(updateUser).toHaveBeenLastCalledWith('target-1', { role, active: true });
		}

		const inactive = new FormData();
		inactive.set('active', 'false');
		await expect(submit(inactive)).resolves.toMatchObject({ success: true });
		expect(updateUser).toHaveBeenLastCalledWith('target-1', { active: false });
	});

	test('preserves omitted fields and empty-role omission', async () => {
		const formData = new FormData();
		formData.set('role', '');
		await expect(submit(formData)).resolves.toMatchObject({ success: true });
		expect(updateUser).toHaveBeenCalledWith('target-1', {});
	});

	test('blocks self-demotion and self-deactivation after parsing', async () => {
		const demotion = new FormData();
		demotion.set('role', 'viewer');
		await expect(submit(demotion, admin.id)).resolves.toMatchObject({
			status: 400,
			data: { error: 'Cannot remove your own admin role' }
		});

		const deactivation = new FormData();
		deactivation.set('active', 'false');
		await expect(submit(deactivation, admin.id)).resolves.toMatchObject({
			status: 400,
			data: { error: 'Cannot deactivate your own account' }
		});

		const bypass = new FormData();
		bypass.set('active', '0');
		await expect(submit(bypass, admin.id)).resolves.toMatchObject({ status: 400 });
		expect(updateUser).not.toHaveBeenCalled();
	});
});
