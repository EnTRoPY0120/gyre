import { describe, expect, test } from 'bun:test';
import { buildAdminReadinessSummary } from '../lib/server/admin-readiness';
import type { AdminReadinessState } from '../lib/server/admin-readiness';

function makeState(overrides: Partial<AdminReadinessState> = {}): AdminReadinessState {
	return {
		clusterConnected: true,
		localLoginEnabled: false,
		enabledProviderCount: 1,
		backupCount: 1,
		backupEncryptionKey: 'a'.repeat(64),
		nodeEnv: 'production',
		...overrides
	};
}

function statusOf(state: AdminReadinessState, stepId: string): string | undefined {
	const summary = buildAdminReadinessSummary(state);
	return summary.steps.find((step) => step.id === stepId)?.status;
}

describe('admin readiness summary', () => {
	test('cluster connectivity is ready when connected', () => {
		expect(statusOf(makeState({ clusterConnected: true }), 'cluster-connectivity')).toBe('ready');
	});

	test('cluster connectivity is action-required when disconnected', () => {
		expect(statusOf(makeState({ clusterConnected: false }), 'cluster-connectivity')).toBe(
			'action-required'
		);
	});

	test('auth access is attention when only local login is enabled', () => {
		expect(
			statusOf(
				makeState({
					localLoginEnabled: true,
					enabledProviderCount: 0
				}),
				'auth-access'
			)
		).toBe('attention');
	});

	test('auth access is ready when local login is disabled but one provider is enabled', () => {
		expect(
			statusOf(
				makeState({
					localLoginEnabled: false,
					enabledProviderCount: 1
				}),
				'auth-access'
			)
		).toBe('ready');
	});

	test('auth access is action-required when local login and providers are both unavailable', () => {
		expect(
			statusOf(
				makeState({
					localLoginEnabled: false,
					enabledProviderCount: 0
				}),
				'auth-access'
			)
		).toBe('action-required');
	});

	test('backup encryption is ready when set in production', () => {
		expect(
			statusOf(
				makeState({
					nodeEnv: 'production',
					backupEncryptionKey: 'b'.repeat(64)
				}),
				'backup-encryption'
			)
		).toBe('ready');
	});

	test('backup encryption is attention when unset in non-production', () => {
		expect(
			statusOf(
				makeState({
					nodeEnv: 'development',
					backupEncryptionKey: ''
				}),
				'backup-encryption'
			)
		).toBe('attention');
	});

	test('backup encryption is action-required when unset in production', () => {
		expect(
			statusOf(
				makeState({
					nodeEnv: 'production',
					backupEncryptionKey: ''
				}),
				'backup-encryption'
			)
		).toBe('action-required');
	});

	test('backup verification is attention when no backups exist', () => {
		expect(statusOf(makeState({ backupCount: 0 }), 'backup-verification')).toBe('attention');
	});

	test('backup verification is ready when backups exist', () => {
		expect(statusOf(makeState({ backupCount: 2 }), 'backup-verification')).toBe('ready');
	});

	test('summary aggregates mixed step statuses correctly', () => {
		const summary = buildAdminReadinessSummary(
			makeState({
				clusterConnected: true,
				localLoginEnabled: true,
				enabledProviderCount: 0,
				backupEncryptionKey: '',
				nodeEnv: 'production',
				backupCount: 1
			})
		);

		expect(summary.status).toBe('action-required');
		expect(summary.readyCount).toBe(2);
		expect(summary.attentionCount).toBe(1);
		expect(summary.actionRequiredCount).toBe(1);
	});
});
