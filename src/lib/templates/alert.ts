import type { ResourceTemplate } from './types.js';

export const ALERT_TEMPLATE: ResourceTemplate = {
	id: 'alert-base',
	name: 'Alert',
	description: 'Sends notifications for FluxCD events',
	kind: 'Alert',
	group: 'notification.toolkit.fluxcd.io',
	version: 'v1beta3',
	category: 'notifications',
	plural: 'alerts',
	yaml: `apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: example
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
    - kind: GitRepository
      name: '*'
    - kind: Kustomization
      name: '*'`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'notification',
			title: 'Notification Settings',
			description: 'Provider and severity configuration',
			defaultExpanded: true
		},
		{
			id: 'advanced',
			title: 'Advanced Options',
			description: 'Event filtering and summary',
			collapsible: true,
			defaultExpanded: false
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
			placeholder: 'my-alert',
			description: 'Unique name for this Alert resource',
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

		// Notification Settings
		{
			name: 'providerName',
			label: 'Provider Name',
			path: 'spec.providerRef.name',
			type: 'string',
			required: true,
			section: 'notification',
			placeholder: 'slack',
			description: 'Name of the Provider resource to send notifications to',
			referenceType: 'Provider'
		},
		{
			name: 'eventSources',
			label: 'Event Sources',
			path: 'spec.eventSources',
			type: 'array',
			required: true,
			section: 'notification',
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
				'Resources to monitor for events. Use * for name to watch all resources of that kind.',
			helpText:
				'Define which FluxCD resources to monitor. Each entry needs a kind (e.g., GitRepository, Kustomization) and name (use * for all).',
			docsUrl: 'https://fluxcd.io/flux/components/notification/alerts/#event-sources'
		},
		{
			name: 'eventSeverity',
			label: 'Event Severity',
			path: 'spec.eventSeverity',
			type: 'select',
			section: 'notification',
			default: 'info',
			options: [
				{ label: 'Info (all events)', value: 'info' },
				{ label: 'Error (only errors)', value: 'error' }
			],
			description: 'Minimum severity level to trigger alerts'
		},

		// Advanced Options
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Suspend sending notifications'
		},
		{
			name: 'summary',
			label: 'Summary',
			path: 'spec.summary',
			type: 'string',
			section: 'advanced',
			placeholder: 'Production cluster alerts',
			description:
				'Optional summary to include in notifications (Deprecated: use Event Metadata instead)'
		},
		{
			name: 'eventMetadata',
			label: 'Event Metadata',
			path: 'spec.eventMetadata',
			type: 'textarea',
			section: 'advanced',
			placeholder: 'cluster: prod-1\nenv: production',
			description: 'Additional metadata to include in alerts (YAML format)'
		},
		{
			name: 'inclusionList',
			label: 'Inclusion List',
			path: 'spec.inclusionList',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: 'Succeeded',
			description: 'Specific events to include (if empty, all events are included)'
		},
		{
			name: 'exclusionList',
			label: 'Exclusion List',
			path: 'spec.exclusionList',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: 'Progressing',
			description: 'Events to exclude from notifications'
		}
	]
};
