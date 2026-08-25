import { describe, expect, test } from 'vitest';
import { deriveClusterRecoverySummary } from '../lib/clusters/recovery.js';
import type { HealthCheckResult } from '../lib/server/clusters/health.js';

function check(name: string, passed: boolean): HealthCheckResult {
	return { name, passed, message: `${name} ${passed ? 'passed' : 'failed'}` };
}

describe('deriveClusterRecoverySummary', () => {
	test('returns no recovery guidance when every diagnostic check passes', () => {
		expect(deriveClusterRecoverySummary([check('Kubeconfig Access', true)])).toBeNull();
	});

	test('uses the first failing check so guidance matches the earliest repair point', () => {
		const summary = deriveClusterRecoverySummary([
			check('Kubeconfig Parse', false),
			check('Authorization', false)
		]);

		expect(summary?.title).toBe('Fix the uploaded kubeconfig first');
		expect(summary?.actions[0]).toEqual({
			label: 'Upload corrected kubeconfig',
			action: 'openCreateModal'
		});
	});

	test('provides safe fallback guidance for a new diagnostic check', () => {
		const summary = deriveClusterRecoverySummary([check('Certificate Expiry', false)]);

		expect(summary).toEqual({
			title: 'Review the failing diagnostic check',
			description:
				'Use the failed check details below to correct the configuration, then run the test again.',
			guidance: ['Start with the first failing check and verify its detailed error message.'],
			actions: [{ label: 'Retest connection', action: 'retest' }]
		});
	});

	test('connects authorization failures to RBAC review', () => {
		const summary = deriveClusterRecoverySummary([check('Authorization', false)]);

		expect(summary?.actions).toEqual([
			{ label: 'Review RBAC', href: '/admin/policies' },
			{ label: 'Retest connection', action: 'retest' }
		]);
	});
});
