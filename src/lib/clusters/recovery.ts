import type { HealthCheckResult } from '$lib/server/clusters';

export type ClusterRecoverySummaryAction =
	| {
			label: string;
			href: string;
			action?: never;
	  }
	| {
			label: string;
			action: 'openCreateModal' | 'retest';
			href?: never;
	  };

export interface ClusterRecoverySummary {
	title: string;
	description: string;
	guidance: string[];
	actions: ClusterRecoverySummaryAction[];
}

export function getFirstFailingHealthCheck(
	checks: HealthCheckResult[]
): HealthCheckResult | undefined {
	return checks.find((check) => !check.passed);
}

export function deriveClusterRecoverySummary(
	checks: HealthCheckResult[]
): ClusterRecoverySummary | null {
	const failingCheck = getFirstFailingHealthCheck(checks);
	if (!failingCheck) {
		return null;
	}

	switch (failingCheck.name) {
		case 'Kubeconfig Access':
			return {
				title: 'Restore kubeconfig access for Gyre',
				description:
					'Gyre could not read the stored kubeconfig. Ensure the kubeconfig source is readable and that any mounted credentials or secrets are available to the Gyre runtime.',
				guidance: [
					'Verify file permissions and ownership allow Gyre to read the kubeconfig.',
					'Confirm the expected context and user entries are present in the kubeconfig.',
					'If credentials come from a secret or mount, verify it exists and is readable by Gyre.'
				],
				actions: [
					{ label: 'Upload corrected kubeconfig', action: 'openCreateModal' },
					{ label: 'Review Settings', href: '/admin/settings' },
					{ label: 'Retest connection', action: 'retest' }
				]
			};
		case 'Kubeconfig Parse':
			return {
				title: 'Fix the uploaded kubeconfig first',
				description:
					'Gyre could not parse the kubeconfig. Replace it with a corrected file before retesting the cluster connection.',
				guidance: [
					'Confirm the kubeconfig is valid YAML or JSON.',
					'Check that the current context and user entries are present and not truncated.'
				],
				actions: [
					{ label: 'Upload corrected kubeconfig', action: 'openCreateModal' },
					{ label: 'Review Settings', href: '/admin/settings' }
				]
			};
		case 'API Server Reachability':
			return {
				title: 'Verify API reachability and network path',
				description:
					'Gyre could not reach the Kubernetes API server. Verify the API URL, DNS, firewall, and cluster network reachability before retrying.',
				guidance: [
					'Check the API server host and port in the kubeconfig.',
					'Confirm DNS resolution and outbound network access from the Gyre instance.'
				],
				actions: [
					{ label: 'Retest connection', action: 'retest' },
					{ label: 'Review Settings', href: '/admin/settings' }
				]
			};
		case 'Authentication':
			return {
				title: 'Refresh cluster credentials',
				description:
					'Gyre reached the cluster but authentication failed. Update the kubeconfig token, certificate, or service account credentials, then retest.',
				guidance: [
					'Replace expired or rotated tokens, client certificates, or exec credentials.',
					'Verify the kubeconfig still points at the intended user and context.'
				],
				actions: [
					{ label: 'Update kubeconfig', action: 'openCreateModal' },
					{ label: 'Retest connection', action: 'retest' }
				]
			};
		case 'Authorization':
			return {
				title: 'Grant Gyre the required RBAC access',
				description:
					'Authentication succeeded, but Gyre could not list namespaces. Grant the namespace read/list permissions Gyre needs, then retest.',
				guidance: [
					'Review the role or cluster role bound to the Gyre user or service account.',
					'Confirm namespace listing and read access are allowed for the target cluster.'
				],
				actions: [
					{ label: 'Review RBAC', href: '/admin/policies' },
					{ label: 'Retest connection', action: 'retest' }
				]
			};
		default:
			return {
				title: 'Review the failing diagnostic check',
				description:
					'Use the failed check details below to correct the configuration, then run the test again.',
				guidance: ['Start with the first failing check and verify its detailed error message.'],
				actions: [{ label: 'Retest connection', action: 'retest' }]
			};
	}
}
