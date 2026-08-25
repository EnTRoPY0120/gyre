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
let errorLog: ReturnType<typeof vi.fn>;
let loadOrCreateInClusterAdmin: InClusterAdminModule['loadOrCreateInClusterAdmin'];
let originalAdminPassword: string | undefined;

beforeEach(async () => {
	vi.resetModules();
	originalAdminPassword = process.env.ADMIN_PASSWORD;
	delete process.env.ADMIN_PASSWORD;

	api = {
		readNamespacedSecret: vi.fn(),
		createNamespacedSecret: vi.fn().mockResolvedValue({}),
		patchNamespacedSecret: vi.fn().mockResolvedValue({})
	};
	hashPassword = vi.fn(async (password: string) => `hash:${password}`);
	generateStrongPassword = vi.fn(() => 'Generated-strong-password1!');
	validateAdminPasswordStrength = vi.fn();
	errorLog = vi.fn();

	vi.doMock('../lib/server/kubernetes/config.js', () => ({
		loadKubeConfig: () => ({ makeApiClient: () => api })
	}));
	vi.doMock('../lib/server/auth/passwords.js', () => ({
		generateStrongPassword,
		hashPassword,
		normalizeUsername: (username: string) => username.toLowerCase().trim(),
		validateAdminPasswordStrength,
		verifyPassword: vi.fn()
	}));
	vi.doMock('../lib/server/logger.js', () => ({
		logger: {
			error: errorLog,
			info: vi.fn(),
			warn: vi.fn()
		}
	}));

	loadOrCreateInClusterAdmin = (
		await importFresh<InClusterAdminModule>('../lib/server/auth/in-cluster-admin.js')
	).loadOrCreateInClusterAdmin;
});

afterEach(() => {
	if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
	else process.env.ADMIN_PASSWORD = originalAdminPassword;
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
