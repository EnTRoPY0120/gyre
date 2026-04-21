import type { ResourceTemplate } from './types.js';

export const IMAGE_POLICY_TEMPLATE: ResourceTemplate = {
	id: 'image-policy-base',
	name: 'Image Policy',
	description: 'Defines policies for selecting image versions',
	kind: 'ImagePolicy',
	group: 'image.toolkit.fluxcd.io',
	version: 'v1',
	category: 'image-automation',
	plural: 'imagepolicies',
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: example
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: example
  policy:
    semver:
      range: ">=1.0.0"`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'policy',
			title: 'Policy Configuration',
			description: 'Rules for selecting images',
			defaultExpanded: true
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
			placeholder: 'my-policy',
			description: 'Unique name for this ImagePolicy resource',
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
			name: 'imageRepoName',
			label: 'Image Repository',
			path: 'spec.imageRepositoryRef.name',
			type: 'string',
			required: true,
			section: 'policy',
			placeholder: 'my-app',
			referenceType: 'ImageRepository',
			description: 'ImageRepository to monitor'
		},
		{
			name: 'policyType',
			label: 'Policy Type',
			path: 'spec.policy.type',
			type: 'select',
			section: 'policy',
			default: 'semver',
			virtual: true,
			options: [
				{ label: 'SemVer', value: 'semver' },
				{ label: 'Numerical', value: 'numerical' },
				{ label: 'Alphabetical', value: 'alphabetical' }
			]
		},
		{
			name: 'semverRange',
			label: 'Semver Range',
			path: 'spec.policy.semver.range',
			type: 'string',
			section: 'policy',
			default: '>=1.0.0',
			showIf: { field: 'policyType', value: 'semver' }
		},
		{
			name: 'numericalOrder',
			label: 'Order',
			path: 'spec.policy.numerical.order',
			type: 'select',
			section: 'policy',
			default: 'asc',
			options: [
				{ label: 'Ascending', value: 'asc' },
				{ label: 'Descending', value: 'desc' }
			],
			showIf: { field: 'policyType', value: 'numerical' }
		},
		{
			name: 'alphabeticalOrder',
			label: 'Order',
			path: 'spec.policy.alphabetical.order',
			type: 'select',
			section: 'policy',
			default: 'asc',
			options: [
				{ label: 'Ascending', value: 'asc' },
				{ label: 'Descending', value: 'desc' }
			],
			showIf: { field: 'policyType', value: 'alphabetical' }
		}
	]
};
