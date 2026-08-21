import { describe, expect, test } from 'vitest';
import {
	describeAuthenticationFailure,
	describeReachabilityError,
	isAuthenticationRelatedError
} from '../lib/server/clusters/health-helpers.js';
import { checkKubeconfigParse } from '../lib/server/clusters/health-checks.js';

describe('cluster health diagnostics', () => {
	test('classifies authentication and authorization failures', () => {
		expect(isAuthenticationRelatedError('request failed with 401')).toBe(true);
		expect(isAuthenticationRelatedError('connection refused')).toBe(false);
		expect(describeAuthenticationFailure('Forbidden: list namespaces')).toEqual({
			name: 'Authorization',
			message: 'Authorization failed',
			details:
				'Authorization failed. The user/service account does not have permission to list namespaces. Gyre requires at least namespace listing permissions.'
		});
	});

	test('maps common network errors to actionable details', () => {
		expect(describeReachabilityError('getaddrinfo ENOTFOUND api')).toContain(
			'DNS resolution failed'
		);
		expect(describeReachabilityError('ECONNREFUSED')).toContain('Connection refused');
		expect(describeReachabilityError('ETIMEDOUT')).toContain('Connection timed out');
	});

	test('reports kubeconfig parsing without leaking parser details into the UI message', () => {
		const valid = checkKubeconfigParse(`
apiVersion: v1
kind: Config
clusters:
  - name: test
    cluster:
      server: https://kubernetes.example
contexts:
  - name: test
    context:
      cluster: test
      user: test
current-context: test
users:
  - name: test
    user: {}
`);
		expect(valid.check).toMatchObject({
			name: 'Kubeconfig Parse',
			passed: true,
			message: 'Kubeconfig is valid YAML/JSON'
		});
		expect(valid.kc).toBeDefined();

		const invalid = checkKubeconfigParse('not: [valid');
		expect(invalid.check).toMatchObject({
			name: 'Kubeconfig Parse',
			passed: false,
			message: 'Failed to parse kubeconfig'
		});
	});
});
