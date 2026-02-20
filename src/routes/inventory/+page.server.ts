import type { PageServerLoad } from './$types';
import {
	getResourceStatus,
	type FluxResource as RelationshipsFluxResource
} from '$lib/utils/relationships';
import type { FluxResource as ServerFluxResource } from '$lib/server/kubernetes/flux/types';
import { parseInventory } from '$lib/server/kubernetes/flux/inventory';
import type { ResourceRef } from '$lib/utils/relationships';
import { getInventoryData } from '$lib/server/inventory-data';

interface TreeNode {
	ref: ResourceRef;
	status?: 'ready' | 'pending' | 'failed' | 'suspended';
	children: TreeNode[];
}

export const load: PageServerLoad = async ({ cookies }) => {
	// Get current cluster context from cookie
	const context = cookies.get('gyre_cluster');

	const { resourceMap, relationships, allResources } = await getInventoryData(context);

	// Create nodes for trees
	function createNode(resource: ServerFluxResource, kind: string): TreeNode {
		const node: TreeNode = {
			ref: {
				kind,
				name: resource.metadata.name,
				namespace: resource.metadata.namespace || ''
			},
			status: getResourceStatus(resource as RelationshipsFluxResource),
			children: []
		};

		// If it's a Kustomization or HelmRelease, add its inventory as children
		if ((kind === 'Kustomization' || kind === 'HelmRelease') && resource.status?.inventory) {
			const inventory = parseInventory(resource.status.inventory.entries);
			node.children.push(
				...inventory.map((item) => ({
					ref: {
						kind: item.kind,
						name: item.name,
						namespace: item.namespace
					},
					children: []
				}))
			);
		}

		return node;
	}

	// Build categorized trees
	// 1. Sources Tree (with Apps as children)
	const sourceTrees = [
		...(resourceMap['GitRepository'] || []).map((r) => createNode(r, 'GitRepository')),
		...(resourceMap['HelmRepository'] || []).map((r) => createNode(r, 'HelmRepository')),
		...(resourceMap['OCIRepository'] || []).map((r) => createNode(r, 'OCIRepository')),
		...(resourceMap['Bucket'] || []).map((r) => createNode(r, 'Bucket'))
	];

	// 2. Applications Tree (Kustomizations and HelmReleases)
	const appTrees = [
		...(resourceMap['Kustomization'] || []).map((r) => createNode(r, 'Kustomization')),
		...(resourceMap['HelmRelease'] || []).map((r) => createNode(r, 'HelmRelease'))
	];

	// 3. Image Automation Tree (Repo -> Policy -> Automation)
	const imageRepoNodes = (resourceMap['ImageRepository'] || []).map((r) =>
		createNode(r, 'ImageRepository')
	);
	const imagePolicyNodes = (resourceMap['ImagePolicy'] || []).map((r) =>
		createNode(r, 'ImagePolicy')
	);
	const imageUpdateNodes = (resourceMap['ImageUpdateAutomation'] || []).map((r) =>
		createNode(r, 'ImageUpdateAutomation')
	);

	// Map Apps and Automations to Sources for the Sources tree
	sourceTrees.forEach((sNode) => {
		relationships
			.filter(
				(rel) =>
					rel.target.kind === sNode.ref.kind &&
					rel.target.name === sNode.ref.name &&
					rel.target.namespace === sNode.ref.namespace
			)
			.forEach((rel) => {
				// Kustomizations and HelmReleases (type: 'source')
				if (rel.type === 'source') {
					const appNode = appTrees.find(
						(an) => an.ref.name === rel.source.name && an.ref.namespace === rel.source.namespace
					);
					if (appNode) sNode.children.push(appNode);
				}

				// ImageUpdateAutomations (type: 'uses')
				if (rel.type === 'uses' && rel.source.kind === 'ImageUpdateAutomation') {
					const automationNode = imageUpdateNodes.find(
						(un) => un.ref.name === rel.source.name && un.ref.namespace === rel.source.namespace
					);
					if (automationNode) sNode.children.push(automationNode);
				}
			});
	});

	imageRepoNodes.forEach((repoNode) => {
		relationships
			.filter(
				(rel) =>
					rel.target.kind === 'ImageRepository' &&
					rel.target.name === repoNode.ref.name &&
					rel.target.namespace === repoNode.ref.namespace
			)
			.forEach((rel) => {
				const policyNode = imagePolicyNodes.find(
					(pn) => pn.ref.name === rel.source.name && pn.ref.namespace === rel.source.namespace
				);
				if (policyNode) {
					repoNode.children.push(policyNode);

					// Connect ImageUpdateAutomation to ImagePolicy via explicit 'uses' relationships
					relationships
						.filter(
							(rel) =>
								rel.type === 'uses' &&
								rel.source.kind === 'ImageUpdateAutomation' &&
								rel.target.kind === 'ImagePolicy' &&
								rel.target.name === policyNode.ref.name &&
								rel.target.namespace === policyNode.ref.namespace
						)
						.forEach((rel) => {
							const un = imageUpdateNodes.find(
								(node) =>
									node.ref.name === rel.source.name && node.ref.namespace === rel.source.namespace
							);
							if (!un) return;
							if (
								!policyNode.children.some(
									(c) => c.ref.name === un.ref.name && c.ref.namespace === un.ref.namespace
								)
							) {
								policyNode.children.push(un);
							}
						});
				}
			});
	});

	// 4. Notifications Tree (Provider -> Alert)
	const providerNodes = (resourceMap['Provider'] || []).map((r) => createNode(r, 'Provider'));
	const alertNodes = (resourceMap['Alert'] || []).map((r) => createNode(r, 'Alert'));
	const receiverNodes = (resourceMap['Receiver'] || []).map((r) => createNode(r, 'Receiver'));

	providerNodes.forEach((pNode) => {
		relationships
			.filter(
				(rel) =>
					rel.target.kind === 'Provider' &&
					rel.target.name === pNode.ref.name &&
					rel.target.namespace === pNode.ref.namespace
			)
			.forEach((rel) => {
				const alertNode = alertNodes.find(
					(an) => an.ref.name === rel.source.name && an.ref.namespace === rel.source.namespace
				);
				if (alertNode) pNode.children.push(alertNode);
			});
	});

	// Summary stats
	const stats = {
		sources: sourceTrees.length,
		applications: appTrees.length,
		notifications:
			(resourceMap['Alert']?.length || 0) +
			(resourceMap['Provider']?.length || 0) +
			(resourceMap['Receiver']?.length || 0),
		imageAutomation:
			(resourceMap['ImageRepository']?.length || 0) +
			(resourceMap['ImagePolicy']?.length || 0) +
			(resourceMap['ImageUpdateAutomation']?.length || 0),
		totalRelationships: relationships.length,
		ready: 0,
		failed: 0,
		suspended: 0
	};

	// Calculate overall stats
	allResources.forEach((item) => {
		const status = getResourceStatus(item as RelationshipsFluxResource);
		if (status === 'ready') stats.ready++;
		else if (status === 'failed') stats.failed++;
		else if (status === 'suspended') stats.suspended++;
	});

	// Determine which image automation nodes are top-level (not children of a policy)
	const topLevelImageUpdateNodes = imageUpdateNodes.filter((un) => {
		return !imagePolicyNodes.some((pn) =>
			pn.children.some((c) => c.ref.name === un.ref.name && c.ref.namespace === un.ref.namespace)
		);
	});

	return {
		relationships,
		trees: {
			sources: sourceTrees,
			applications: appTrees,
			notifications: [...providerNodes, ...receiverNodes],
			imageAutomation: [...imageRepoNodes, ...topLevelImageUpdateNodes]
		},
		stats
	};
};
