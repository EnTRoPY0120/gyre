import type { ResourceTemplate } from './types.js';

export const IMAGE_UPDATE_AUTOMATION_TEMPLATE: ResourceTemplate = {
	id: 'image-update-automation-base',
	name: 'Image Update Automation',
	description: 'Automates image updates to Git',
	kind: 'ImageUpdateAutomation',
	group: 'image.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'image-automation',
	plural: 'imageupdateautomations',
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 1h
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@example.com
        name: fluxcdbot
      messageTemplate: "Update image"
  update:
    path: ./clusters/production
    strategy: Setters`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'git',
			title: 'Git Configuration',
			description: 'Repository and commit settings',
			defaultExpanded: true
		},
		{
			id: 'update',
			title: 'Update Strategy',
			description: 'How to apply changes in Git',
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
			section: 'basic'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system'
		},
		{
			name: 'sourceName',
			label: 'Git Repository',
			path: 'spec.sourceRef.name',
			type: 'string',
			required: true,
			section: 'git',
			referenceType: 'GitRepository'
		},
		{
			name: 'branch',
			label: 'Branch',
			path: 'spec.git.checkout.ref.branch',
			type: 'string',
			section: 'git',
			default: 'main'
		},
		{
			name: 'updatePath',
			label: 'Update Path',
			path: 'spec.update.path',
			type: 'string',
			section: 'update',
			default: './',
			description: 'Path in Git repository to look for image markers'
		},
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'update',
			default: '1h'
		}
	]
};
