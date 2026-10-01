import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';

type InClusterAdminModule = typeof import('../lib/server/auth/in-cluster-admin.js');

interface SecretApi {
	readNamespacedSecret: ReturnType<typeof vi.fn>;
	createNamespacedSecret: ReturnType<typeof vi.fn>;
	patchNamespacedSecret: ReturnType<typeof vi.fn>;
}

let api: SecretApi;
let hashPassword: ReturnType<typeof vi.fn>;
let generateStrongPassword: ReturnType<typeof vi.fn>;
let validateAdminPasswordStrength: ReturnType<typeof vi.fn>;
let verifyPassword: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.fn>;
let loadOrCreateInClusterAdmin: InClusterAdminModule['loadOrCreateInClusterAdmin'];
let validateInClusterAdmin: InClusterAdminModule['validateInClusterAdmin'];
let originalAdminPassword: string | undefined;
let originalAdminSecretName: string | undefined;

beforeEach(async () => {
	vi.resetModules();
	originalAdminPassword = process.env.ADMIN_PASSWORD;
	originalAdminSecretName = process.env.GYRE_ADMIN_SECRET_NAME;
	delete process.env.ADMIN_PASSWORD;
	delete process.env.GYRE_ADMIN_SECRET_NAME;

	api = {
		readNamespacedSecret: vi.fn(),
		createNamespacedSecret: vi.fn().mockResolvedValue({}),
		patchNamespacedSecret: vi.fn().mockResolvedValue({})
	};
	hashPassword = vi.fn(async (password: string) => `hash:${password}`);
	generateStrongPassword = vi.fn(() => 'Generated-strong-password1!');
	validateAdminPasswordStrength = vi.fn();
	verifyPassword = vi.fn().mockResolvedValue(false);
	errorLog = vi.fn();

	vi.doMock('../lib/server/kubernetes/config.js', () => ({
		loadKubeConfig: () => ({ makeApiClient: () => api })
	}));
	vi.doMock('../lib/server/auth/passwords.js', () => ({
		generateStrongPassword,
		hashPassword,
		normalizeUsername: (username: string) => username.toLowerCase().trim(),
		validateAdminPasswordStrength,
		verifyPassword
	}));
	vi.doMock('../lib/server/logger.js', () => ({
		logger: {
			error: errorLog,
			info: vi.fn(),
			warn: vi.fn()
		}
	}));

	const module = await importFresh<InClusterAdminModule>('../lib/server/auth/in-cluster-admin.js');
	loadOrCreateInClusterAdmin = module.loadOrCreateInClusterAdmin;
	validateInClusterAdmin = module.validateInClusterAdmin;
});

afterEach(() => {
	if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
	else process.env.ADMIN_PASSWORD = originalAdminPassword;
	if (originalAdminSecretName === undefined) delete process.env.GYRE_ADMIN_SECRET_NAME;
	else process.env.GYRE_ADMIN_SECRET_NAME = originalAdminSecretName;
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('in-cluster admin bootstrap', () => {
	test('loads an existing password and preserves its consumed state', async () => {
		api.readNamespacedSecret
			.mockResolvedValueOnce({
				data: { password: Buffer.from('existing-password').toString('base64') }
			})
			.mockResolvedValueOnce({
				metadata: { labels: { 'gyre.io/initial-password-consumed': 'true' } }
			});

		await expect(loadOrCreateInClusterAdmin()).resolves.toBe('existing-password');
		expect(hashPassword).toHaveBeenCalledWith('existing-password');
		expect(api.readNamespacedSecret).toHaveBeenCalledTimes(2);
		expect(api.createNamespacedSecret).not.toHaveBeenCalled();
	});

	test('creates a generated password when the initial secret is missing', async () => {
		api.readNamespacedSecret.mockRejectedValue(
			Object.assign(new Error('not found'), { code: 404 })
		);

		await expect(loadOrCreateInClusterAdmin()).resolves.toBe('Generated-strong-password1!');
		expect(generateStrongPassword).toHaveBeenCalledOnce();
		expect(hashPassword).toHaveBeenCalledWith('Generated-strong-password1!');
		expect(api.createNamespacedSecret).toHaveBeenCalledWith({
			namespace: 'default',
			body: expect.objectContaining({
				metadata: expect.objectContaining({ name: 'gyre-initial-admin-secret' }),
				stringData: { password: 'Generated-strong-password1!' }
			})
		});
	});

	test('uses configured secret name when loading or creating the initial admin password', async () => {
		process.env.GYRE_ADMIN_SECRET_NAME = 'custom-admin-password';
		vi.resetModules();
		const module = await importFresh<InClusterAdminModule>(
			'../lib/server/auth/in-cluster-admin.js?custom-secret'
		);
		loadOrCreateInClusterAdmin = module.loadOrCreateInClusterAdmin;
		validateInClusterAdmin = module.validateInClusterAdmin;
		api.readNamespacedSecret.mockRejectedValue(
			Object.assign(new Error('not found'), { code: 404 })
		);

		await expect(loadOrCreateInClusterAdmin()).resolves.toBe('Generated-strong-password1!');
		expect(api.readNamespacedSecret).toHaveBeenCalledWith({
			name: 'custom-admin-password',
			namespace: 'default'
		});
		expect(api.createNamespacedSecret).toHaveBeenCalledWith({
			namespace: 'default',
			body: expect.objectContaining({
				metadata: expect.objectContaining({ name: 'custom-admin-password' }),
				stringData: { password: 'Generated-strong-password1!' }
			})
		});
	});

	test('uses configured secret name when marking the initial password consumed', async () => {
		process.env.GYRE_ADMIN_SECRET_NAME = 'custom-admin-password';
		vi.resetModules();
		const module = await importFresh<InClusterAdminModule>(
			'../lib/server/auth/in-cluster-admin.js?custom-secret-consumed'
		);
		loadOrCreateInClusterAdmin = module.loadOrCreateInClusterAdmin;
		validateInClusterAdmin = module.validateInClusterAdmin;
		api.readNamespacedSecret
			.mockResolvedValueOnce({
				data: { password: Buffer.from('existing-password').toString('base64') }
			})
			.mockResolvedValueOnce({ metadata: {} });
		verifyPassword.mockResolvedValue(true);

		await expect(loadOrCreateInClusterAdmin()).resolves.toBe('existing-password');
		await expect(validateInClusterAdmin('existing-password')).resolves.toBe(true);
		expect(api.readNamespacedSecret).toHaveBeenNthCalledWith(1, {
			name: 'custom-admin-password',
			namespace: 'default'
		});
		expect(api.readNamespacedSecret).toHaveBeenNthCalledWith(2, {
			name: 'custom-admin-password',
			namespace: 'default'
		});
		const [patchRequest, patchOptions] = api.patchNamespacedSecret.mock.calls[0];
		expect(patchRequest).toEqual({
			name: 'custom-admin-password',
			namespace: 'default',
			body: { metadata: { labels: { 'gyre.io/initial-password-consumed': 'true' } } }
		});
		expect(patchOptions.middlewareMergeStrategy).toBe('append');
		const setHeaderParam = vi.fn();
		await patchOptions.middleware[0].pre({ setHeaderParam } as never).toPromise();
		expect(setHeaderParam).toHaveBeenCalledWith('Content-Type', 'application/merge-patch+json');
	});

	test('creates a password when the existing secret has no password data', async () => {
		api.readNamespacedSecret.mockResolvedValueOnce({ data: {} });

		await expect(loadOrCreateInClusterAdmin()).resolves.toBe('Generated-strong-password1!');
		expect(api.readNamespacedSecret).toHaveBeenCalledTimes(1);
		expect(api.createNamespacedSecret).toHaveBeenCalledOnce();
	});

	test('rethrows unexpected secret errors after logging the bootstrap failure', async () => {
		const error = new Error('forbidden');
		api.readNamespacedSecret.mockRejectedValue(error);

		await expect(loadOrCreateInClusterAdmin()).rejects.toBe(error);
		expect(errorLog).toHaveBeenCalledWith(
			error,
			expect.stringContaining('Failed to setup in-cluster admin')
		);
		expect(api.createNamespacedSecret).not.toHaveBeenCalled();
	});
});
