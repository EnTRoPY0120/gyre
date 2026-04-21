import type { ResourceTemplate } from './types.js';

export const RECEIVER_TEMPLATE: ResourceTemplate = {
	id: 'receiver-base',
	name: 'Receiver',
	description: 'Webhook receiver for external events',
	kind: 'Receiver',
	group: 'notification.toolkit.fluxcd.io',
	version: 'v1',
	category: 'notifications',
	plural: 'receivers',
	yaml: `apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: example
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: webhook-token
  resources:
    - kind: GitRepository
      name: webapp`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'receiver',
			title: 'Receiver Configuration',
			description: 'Webhook receiver settings',
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
			placeholder: 'github-receiver',
			description: 'Unique name for this Receiver resource',
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

		// Receiver Configuration
		{
			name: 'type',
			label: 'Receiver Type',
			path: 'spec.type',
			type: 'select',
			required: true,
			section: 'receiver',
			default: 'github',
			options: [
				{ label: 'GitHub', value: 'github' },
				{ label: 'GitLab', value: 'gitlab' },
				{ label: 'Bitbucket', value: 'bitbucket' },
				{ label: 'Harbor', value: 'harbor' },
				{ label: 'DockerHub', value: 'dockerhub' },
				{ label: 'Quay', value: 'quay' },
				{ label: 'Nexus', value: 'nexus' },
				{ label: 'ACR', value: 'acr' },
				{ label: 'GCR', value: 'gcr' },
				{ label: 'CDEvents', value: 'cdevents' },
				{ label: 'Generic Webhook', value: 'generic' },
				{ label: 'Generic HMAC', value: 'generic-hmac' }
			],
			description: 'Type of webhook receiver'
		},
		{
			name: 'resources',
			label: 'Resources',
			path: 'spec.resources',
			type: 'array',
			required: true,
			section: 'receiver',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'kind',
					label: 'Kind',
					path: 'kind',
					type: 'string',
					required: true,
					placeholder: 'GitRepository',
					description: 'Resource kind (e.g., GitRepository, Kustomization)'
				},
				{
					name: 'name',
					label: 'Name',
					path: 'name',
					type: 'string',
					required: true,
					placeholder: '* or resource name',
					description: 'Resource name; use * to watch all resources of that kind',
					referenceTypeField: 'kind',
					referenceNamespaceField: 'namespace'
				}
			],
			placeholder: 'GitRepository',
			description:
				'FluxCD resources to reconcile when webhook is triggered. Use * for name to reconcile all resources of that kind.',
			helpText:
				'Define which resources should be reconciled when this webhook receives an event. Each entry needs a kind (e.g., GitRepository, HelmRelease) and name (use * for all).',
			docsUrl: 'https://fluxcd.io/flux/components/notification/receivers/#resources'
		},
		{
			name: 'events',
			label: 'Events',
			path: 'spec.events',
			type: 'array',
			section: 'receiver',
			arrayItemType: 'string',
			placeholder: 'push',
			description: 'Specific events to receive (if empty, all events are received)'
		},
		{
			name: 'secretName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			required: true,
			section: 'receiver',
			placeholder: 'webhook-token',
			description: 'Secret containing webhook validation token'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			section: 'receiver',
			placeholder: '10m',
			description: 'Reconciliation interval',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'receiver',
			default: false,
			description: 'Suspend webhook processing'
		}
	]
};
