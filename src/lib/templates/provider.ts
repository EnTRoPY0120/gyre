import { CEL_VALIDATION, type ResourceTemplate } from './types.js';

export const PROVIDER_TEMPLATE: ResourceTemplate = {
	id: 'provider-base',
	name: 'Provider',
	description: 'Configures a notification provider',
	kind: 'Provider',
	group: 'notification.toolkit.fluxcd.io',
	version: 'v1beta3',
	category: 'notifications',
	plural: 'providers',
	yaml: `apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: general
  secretRef:
    name: slack-webhook-url`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'provider',
			title: 'Provider Configuration',
			description: 'Notification provider settings',
			defaultExpanded: true
		}
	],
	fields: [
		// Basic Information
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			section: 'basic',
			placeholder: 'slack',
			description: 'Unique name for this Provider resource',
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Name must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created',
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Namespace must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},

		// Provider Configuration
		{
			name: 'type',
			label: 'Provider Type',
			path: 'spec.type',
			type: 'select',
			required: true,
			section: 'provider',
			default: 'slack',
			options: [
				{ label: 'Slack', value: 'slack' },
				{ label: 'Discord', value: 'discord' },
				{ label: 'Microsoft Teams', value: 'msteams' },
				{ label: 'Rocket', value: 'rocket' },
				{ label: 'Google Chat', value: 'googlechat' },
				{ label: 'Webex', value: 'webex' },
				{ label: 'GitHub', value: 'github' },
				{ label: 'GitLab', value: 'gitlab' },
				{ label: 'Gitea', value: 'gitea' },
				{ label: 'Bitbucket', value: 'bitbucket' },
				{ label: 'Bitbucket Server', value: 'bitbucketserver' },
				{ label: 'Azure DevOps', value: 'azuredevops' },
				{ label: 'Google Pub/Sub', value: 'googlepubsub' },
				{ label: 'Generic Webhook', value: 'generic' },
				{ label: 'Generic HMAC', value: 'generic-hmac' }
			],
			description: 'Type of notification provider'
		},
		{
			name: 'channel',
			label: 'Channel',
			path: 'spec.channel',
			type: 'string',
			section: 'provider',
			placeholder: 'general',
			description: 'Channel name (for Slack, Discord, etc.)'
		},
		{
			name: 'username',
			label: 'Username',
			path: 'spec.username',
			type: 'string',
			section: 'provider',
			placeholder: 'FluxCD Bot',
			description: 'Override username for notifications'
		},
		{
			name: 'secretName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			section: 'provider',
			placeholder: 'slack-webhook-url',
			description: 'Secret containing webhook URL or credentials (if not using inline address)'
		},
		{
			name: 'address',
			label: 'Address',
			path: 'spec.address',
			type: 'string',
			section: 'provider',
			placeholder: 'https://hooks.slack.com/services/...',
			description: 'Webhook URL or API address (if not in secret)'
		},
		{
			name: 'proxy',
			label: 'Proxy',
			path: 'spec.proxy',
			type: 'string',
			section: 'provider',
			placeholder: 'http://proxy.example.com:8080',
			description: 'Proxy address to use for notifications'
		},
		{
			name: 'tlsCertSecret',
			label: 'TLS Certificate Secret',
			path: 'spec.certSecretRef.name',
			type: 'string',
			section: 'provider',
			placeholder: 'tls-cert',
			description: 'Secret containing TLS certificate'
		},
		{
			name: 'proxySecretRef',
			label: 'Proxy Secret',
			path: 'spec.proxySecretRef.name',
			type: 'string',
			section: 'provider',
			placeholder: 'proxy-credentials',
			description: 'Secret containing proxy credentials'
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'provider',
			default: '10m',
			placeholder: '30s',
			description: 'Timeout for sending notifications',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))*$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'provider',
			default: false,
			description: 'Suspend notifications'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'provider',
			placeholder: 'notification-controller',
			description: 'ServiceAccount for cloud provider authentication'
		},
		{
			name: 'commitStatusExpr',
			label: 'Commit Status Expression',
			path: 'spec.commitStatusExpr',
			type: 'textarea',
			section: 'provider',
			placeholder: 'event.message',
			description: 'CEL expression for custom commit status message',
			validation: CEL_VALIDATION
		}
	]
};
