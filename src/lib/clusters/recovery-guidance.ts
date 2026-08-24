import type { ClusterRecoverySummary } from './recovery';

const DEFAULT_RECOVERY_SUMMARY: ClusterRecoverySummary = {
	title: 'Review the failing diagnostic check',
	description:
		'Use the failed check details below to correct the configuration, then run the test again.',
	guidance: ['Start with the first failing check and verify its detailed error message.'],
	actions: [{ label: 'Retest connection', action: 'retest' }]
};

const RECOVERY_SUMMARIES: Record<string, ClusterRecoverySummary> = {
	'Kubeconfig Access': {
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
	},
	'Kubeconfig Parse': {
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
	},
	'API Server Reachability': {
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
	},
	Authentication: {
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
	},
	Authorization: {
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
	}
};

export function getRecoverySummaryForCheck(checkName: string): ClusterRecoverySummary {
	return RECOVERY_SUMMARIES[checkName] ?? DEFAULT_RECOVERY_SUMMARY;
}
