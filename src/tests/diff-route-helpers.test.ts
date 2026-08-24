import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	authorizeDiffRoute,
	handleDiffRouteError,
	validateDiffRoute
} from '../routes/api/v1/flux/[resourceType]/[namespace]/[name]/diff/route-helpers.js';

const route = {
	resourceType: 'kustomizations',
	namespace: 'apps',
	name: 'demo',
	clusterId: 'cluster-a',
	forceRefresh: true
};

function captureThrown(callback: () => unknown): unknown {
	try {
		callback();
	} catch (error) {
		return error;
	}
	return undefined;
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe('validateDiffRoute', () => {
	test('returns normalized kustomization context and honors FLUX_NAMESPACE', () => {
		vi.stubEnv('KUBERNETES_SERVICE_HOST', '10.0.0.1');
		vi.stubEnv('FLUX_NAMESPACE', 'platform-system');

		expect(validateDiffRoute(route)).toEqual({
			...route,
			resourceType: 'Kustomization',
			fluxNamespace: 'platform-system'
		});
	});

	test('rejects unsupported resource types', () => {
		vi.stubEnv('KUBERNETES_SERVICE_HOST', '10.0.0.1');

		expect(
			captureThrown(() => validateDiffRoute({ ...route, resourceType: 'gitrepositories' }))
		).toMatchObject({
			status: 400,
			body: { message: 'Diffing is only supported for Kustomizations' }
		});
	});

	test('rejects local development mode', () => {
		vi.stubEnv('KUBERNETES_SERVICE_HOST', '');

		expect(captureThrown(() => validateDiffRoute(route))).toMatchObject({
			status: 503,
			body: { message: expect.stringContaining('Drift detection is only available') }
		});
	});
});

describe('authorizeDiffRoute', () => {
	test('requires authentication and scoped read access', async () => {
		const guards = await import('$lib/server/http/guards.js');
		const auth = vi.spyOn(guards, 'requireAuthenticatedUser').mockImplementation(() => undefined);
		const permission = vi.spyOn(guards, 'requireScopedPermission').mockResolvedValue(undefined);

		await authorizeDiffRoute({} as App.Locals, 'apps');

		expect(auth).toHaveBeenCalledOnce();
		expect(permission).toHaveBeenCalledWith({}, 'read', 'Kustomization', 'apps');
		auth.mockRestore();
		permission.mockRestore();
	});
});

describe('handleDiffRouteError', () => {
	test('maps timeout failures to a gateway timeout', () => {
		expect(captureThrown(() => handleDiffRouteError(new Error('request timeout')))).toMatchObject({
			status: 504,
			body: {
				message:
					'Operation timed out. The kustomization may be too large or the source artifact is unavailable.'
			}
		});
	});
});
