import type { ResourceTemplate } from './types.js';

export const IMAGE_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'image-repository-base',
	name: 'Image Repository',
	description: 'Scans container image repositories',
	kind: 'ImageRepository',
	group: 'image.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'image-automation',
	plural: 'imagerepositories',
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  image: ghcr.io/org/app`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'repository',
			title: 'Repository Settings',
			description: 'Container registry and scan configuration',
			defaultExpanded: true
		},
		{
			id: 'auth',
			title: 'Authentication',
			description: 'Registry credentials',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'advanced',
			title: 'Advanced Options',
			description: 'Additional configuration options',
			collapsible: true,
			defaultExpanded: false
		}
	],
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			section: 'basic',
			placeholder: 'my-app',
			description: 'Unique name for this ImageRepository resource',
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
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Namespace must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},
		{
			name: 'image',
			label: 'Image',
			path: 'spec.image',
			type: 'string',
			required: true,
			section: 'repository',
			placeholder: 'ghcr.io/org/app',
			description: 'Container image repository to scan'
		},
		{
			name: 'provider',
			label: 'Registry Provider',
			path: 'spec.provider',
			type: 'select',
			section: 'repository',
			default: 'generic',
			options: [
				{ label: 'Generic', value: 'generic' },
				{ label: 'AWS', value: 'aws' },
				{ label: 'Azure', value: 'azure' },
				{ label: 'GCP', value: 'gcp' }
			],
			description: 'Cloud provider for registry authentication'
		},
		{
			name: 'interval',
			label: 'Scan Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'repository',
			default: '5m',
			description: 'How often to scan for new images',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
		}
	]
};
