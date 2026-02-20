/**
 * Utilities for analyzing and mapping FluxCD resource relationships.
 *
 * Relationship types in FluxCD:
 * - Source → Kustomization: Kustomization references a source (GitRepository, OCIRepository, Bucket)
 * - Source → HelmRelease: HelmRelease references a HelmRepository or GitRepository
 * - Kustomization → Managed Resources: Kustomization manages K8s resources via inventory
 * - HelmRelease → Managed Resources: HelmRelease manages K8s resources via inventory
 * - ImagePolicy → ImageRepository: Policy uses repository for scanning
 * - ImageUpdateAutomation → GitRepository: Updates commits to git repo
 * - Alert → Provider: Alert sends to a provider
 * - Receiver → Resources: Receiver can trigger reconciliation on resources
 */

import { FluxResourceType } from '$lib/types/flux';
import { getResourceHealth } from './flux';

export interface FluxResourceMetadata {
	name: string;
	namespace?: string;
	uid?: string;
	resourceVersion?: string;
	creationTimestamp?: string;
	generation?: number;
	managedFields?: unknown[];
}

export interface FluxResourceSpec {
	suspend?: boolean;
	[key: string]: unknown;
}

export interface FluxResourceStatus {
	conditions?: Array<{
		type: string;
		status: 'True' | 'False' | 'Unknown';
		reason?: string;
		message?: string;
	}>;
	observedGeneration?: number;
}

export interface FluxResource {
	apiVersion?: string;
	kind: string;
	metadata: FluxResourceMetadata;
	spec?: FluxResourceSpec;
	status?: FluxResourceStatus;
}

export interface ResourceRef {
	kind: string;
	name: string;
	namespace?: string;
	apiVersion?: string;
	matchLabels?: Record<string, string>;
}

export interface ResourceRelationship {
	source: ResourceRef;
	target: ResourceRef;
	type: 'source' | 'manages' | 'uses' | 'triggers' | 'notifies';
	label?: string;
}

export interface ResourceNode {
	ref: ResourceRef;
	status?: 'ready' | 'pending' | 'failed' | 'suspended';
	children: ResourceNode[];
	parent?: ResourceNode;
}

/**
 * Extract the source reference from a Kustomization
 */
export function getKustomizationSourceRef(
	kustomization: FluxResource & {
		spec?: { sourceRef?: { kind: string; name: string; namespace?: string; apiVersion?: string } };
	}
): ResourceRef | null {
	const sourceRef = kustomization.spec?.sourceRef;
	if (!sourceRef) return null;

	return {
		kind: sourceRef.kind,
		name: sourceRef.name,
		namespace: sourceRef.namespace || kustomization.metadata.namespace,
		apiVersion: sourceRef.apiVersion
	};
}

/**
 * Extract the source reference from a HelmRelease
 */
export function getHelmReleaseSourceRef(
	helmRelease: FluxResource & {
		spec?: {
			chart?: {
				spec?: {
					sourceRef?: { kind: string; name: string; namespace?: string; apiVersion?: string };
				};
			};
		};
	}
): ResourceRef | null {
	const chart = helmRelease.spec?.chart;
	if (!chart?.spec?.sourceRef) return null;

	const sourceRef = chart.spec.sourceRef;
	return {
		kind: sourceRef.kind,
		name: sourceRef.name,
		namespace: sourceRef.namespace || helmRelease.metadata.namespace,
		apiVersion: sourceRef.apiVersion
	};
}

/**
 * Extract ImageRepository reference from an ImagePolicy
 */
export function getImagePolicyRepositoryRef(
	imagePolicy: FluxResource & {
		spec?: { imageRepositoryRef?: { name: string; namespace?: string } };
	}
): ResourceRef | null {
	const imageRepoRef = imagePolicy.spec?.imageRepositoryRef;
	if (!imageRepoRef) return null;

	return {
		kind: 'ImageRepository',
		name: imageRepoRef.name,
		namespace: imageRepoRef.namespace || imagePolicy.metadata.namespace
	};
}

/**
 * Extract GitRepository reference from ImageUpdateAutomation
 */
export function getImageUpdateAutomationGitRef(
	imageUpdateAutomation: FluxResource & {
		spec?: { sourceRef?: { kind?: string; name: string; namespace?: string } };
	}
): ResourceRef | null {
	const gitRepoRef = imageUpdateAutomation.spec?.sourceRef;
	if (!gitRepoRef) return null;

	return {
		kind: gitRepoRef.kind || 'GitRepository',
		name: gitRepoRef.name,
		namespace: gitRepoRef.namespace || imageUpdateAutomation.metadata.namespace
	};
}

/**
 * Extract Provider reference from an Alert
 */
export function getAlertProviderRef(
	alert: FluxResource & { spec?: { providerRef?: { name: string } } }
): ResourceRef | null {
	const providerRef = alert.spec?.providerRef;
	if (!providerRef) return null;

	return {
		kind: 'Provider',
		name: providerRef.name,
		namespace: alert.metadata.namespace
	};
}

/**
 * Extract event sources from an Alert (resources it watches)
 */
export function getAlertEventSources(
	alert: FluxResource & {
		spec?: {
			eventSources?: Array<{
				kind: string;
				name: string;
				namespace?: string;
				matchLabels?: Record<string, string>;
			}>;
		};
	}
): ResourceRef[] {
	const eventSources = alert.spec?.eventSources || [];
	return eventSources.map((source) => ({
		kind: source.kind,
		name: source.name,
		namespace: source.namespace || alert.metadata.namespace,
		matchLabels: source.matchLabels
	}));
}

/**
 * Extract resources that a Receiver can trigger
 */
export function getReceiverResources(
	receiver: FluxResource & {
		spec?: {
			resources?: Array<{
				kind: string;
				name: string;
				namespace?: string;
				matchLabels?: Record<string, string>;
			}>;
		};
	}
): ResourceRef[] {
	const resources = receiver.spec?.resources || [];
	return resources.map((resource) => ({
		kind: resource.kind,
		name: resource.name,
		namespace: resource.namespace || receiver.metadata.namespace,
		matchLabels: resource.matchLabels
	}));
}

/**
 * Extract dependsOn references from a resource
 */
export function getDependsOnRefs(
	resource: FluxResource & {
		spec?: { dependsOn?: Array<{ name: string; namespace?: string }> };
	}
): ResourceRef[] {
	const dependsOn = resource.spec?.dependsOn || [];
	return dependsOn.map((dep) => ({
		kind: resource.kind, // dependsOn usually implies the same kind (Kust -> Kust, HR -> HR)
		name: dep.name,
		namespace: dep.namespace || resource.metadata.namespace
	}));
}

/**
 * Determine the FluxResourceType from a kind string
 */
export function kindToFluxType(kind: string): FluxResourceType | null {
	const mapping: Record<string, FluxResourceType> = {
		GitRepository: FluxResourceType.GitRepository,
		HelmRepository: FluxResourceType.HelmRepository,
		HelmChart: FluxResourceType.HelmChart,
		Bucket: FluxResourceType.Bucket,
		OCIRepository: FluxResourceType.OCIRepository,
		Kustomization: FluxResourceType.Kustomization,
		HelmRelease: FluxResourceType.HelmRelease,
		Alert: FluxResourceType.Alert,
		Provider: FluxResourceType.Provider,
		Receiver: FluxResourceType.Receiver,
		ImageRepository: FluxResourceType.ImageRepository,
		ImagePolicy: FluxResourceType.ImagePolicy,
		ImageUpdateAutomation: FluxResourceType.ImageUpdateAutomation
	};
	return mapping[kind] || null;
}

/**
 * Build a relationship map from a collection of FluxCD resources
 */
export function buildRelationshipMap(resources: {
	kustomizations?: FluxResource[];
	helmReleases?: FluxResource[];
	gitRepositories?: FluxResource[];
	helmRepositories?: FluxResource[];
	ociRepositories?: FluxResource[];
	buckets?: FluxResource[];
	alerts?: FluxResource[];
	providers?: FluxResource[];
	receivers?: FluxResource[];
	imagePolicies?: FluxResource[];
	imageRepositories?: FluxResource[];
	imageUpdateAutomations?: FluxResource[];
}): ResourceRelationship[] {
	const relationships: ResourceRelationship[] = [];

	// Kustomization → Source
	resources.kustomizations?.forEach((ks) => {
		const sourceRef = getKustomizationSourceRef(ks);
		if (sourceRef) {
			relationships.push({
				source: {
					kind: 'Kustomization',
					name: ks.metadata.name,
					namespace: ks.metadata.namespace
				},
				target: sourceRef,
				type: 'source',
				label: 'uses source'
			});
		}

		// Kustomization → dependsOn (other Kustomizations)
		const dependsOn = getDependsOnRefs(ks);
		dependsOn.forEach((dep) => {
			relationships.push({
				source: {
					kind: 'Kustomization',
					name: ks.metadata.name,
					namespace: ks.metadata.namespace
				},
				target: dep,
				type: 'uses',
				label: 'depends on'
			});
		});
	});

	// HelmRelease → Source
	resources.helmReleases?.forEach((hr) => {
		const sourceRef = getHelmReleaseSourceRef(hr);
		if (sourceRef) {
			relationships.push({
				source: {
					kind: 'HelmRelease',
					name: hr.metadata.name,
					namespace: hr.metadata.namespace
				},
				target: sourceRef,
				type: 'source',
				label: 'uses chart from'
			});
		}

		// HelmRelease → dependsOn (other HelmReleases)
		const dependsOn = getDependsOnRefs(hr);
		dependsOn.forEach((dep) => {
			relationships.push({
				source: {
					kind: 'HelmRelease',
					name: hr.metadata.name,
					namespace: hr.metadata.namespace
				},
				target: dep,
				type: 'uses',
				label: 'depends on'
			});
		});
	});

	// ImagePolicy → ImageRepository
	resources.imagePolicies?.forEach((ip) => {
		const repoRef = getImagePolicyRepositoryRef(ip);
		if (repoRef) {
			relationships.push({
				source: {
					kind: 'ImagePolicy',
					name: ip.metadata.name,
					namespace: ip.metadata.namespace
				},
				target: repoRef,
				type: 'uses',
				label: 'scans'
			});
		}
	});

	// ImageUpdateAutomation → GitRepository
	resources.imageUpdateAutomations?.forEach((iua) => {
		const gitRef = getImageUpdateAutomationGitRef(iua);
		if (gitRef) {
			relationships.push({
				source: {
					kind: 'ImageUpdateAutomation',
					name: iua.metadata.name,
					namespace: iua.metadata.namespace
				},
				target: gitRef,
				type: 'uses',
				label: 'commits to'
			});
		}
	});

	// Alert → Provider
	resources.alerts?.forEach((alert) => {
		const providerRef = getAlertProviderRef(alert);
		if (providerRef) {
			relationships.push({
				source: {
					kind: 'Alert',
					name: alert.metadata.name,
					namespace: alert.metadata.namespace
				},
				target: providerRef,
				type: 'notifies',
				label: 'sends to'
			});
		}

		// Alert → Event sources
		const eventSources = getAlertEventSources(alert);
		eventSources.forEach((source) => {
			if (source.name !== '*') {
				relationships.push({
					source: source,
					target: {
						kind: 'Alert',
						name: alert.metadata.name,
						namespace: alert.metadata.namespace
					},
					type: 'triggers',
					label: 'triggers'
				});
			}
		});
	});

	// Receiver → Resources
	resources.receivers?.forEach((receiver) => {
		const targetResources = getReceiverResources(receiver);
		targetResources.forEach((target) => {
			relationships.push({
				source: {
					kind: 'Receiver',
					name: receiver.metadata.name,
					namespace: receiver.metadata.namespace
				},
				target,
				type: 'triggers',
				label: 'can trigger'
			});
		});
	});

	return relationships;
}

/**
 * Get the status of a resource from its conditions
 */
export function getResourceStatus(
	resource: FluxResource
): 'ready' | 'pending' | 'failed' | 'suspended' {
	const health = getResourceHealth(
		resource.status?.conditions,
		resource.spec?.suspend,
		resource.status?.observedGeneration,
		resource.metadata.generation
	);

	switch (health) {
		case 'healthy':
			return 'ready';
		case 'progressing':
			return 'pending';
		case 'failed':
			return 'failed';
		case 'suspended':
			return 'suspended';
		default:
			return 'pending';
	}
}

/**
 * Create a resource reference key for lookups
 */
export function resourceRefKey(ref: ResourceRef): string {
	return `${ref.kind}/${ref.namespace || 'cluster-scoped'}/${ref.name}`;
}

/**
 * Detect circular dependencies in a set of relationships using DFS cycle detection.
 * Returns an array of node id strings (resourceRefKey format) involved in cycles.
 */
export function detectCircularDependencies(relationships: ResourceRelationship[]): string[] {
	const adj = new Map<string, string[]>();
	for (const rel of relationships) {
		const srcKey = resourceRefKey(rel.source);
		const tgtKey = resourceRefKey(rel.target);
		if (!adj.has(srcKey)) adj.set(srcKey, []);
		adj.get(srcKey)!.push(tgtKey);
	}

	const visited = new Set<string>();
	const inStack = new Set<string>();
	const cycleNodes = new Set<string>();

	function dfs(node: string): boolean {
		if (inStack.has(node)) {
			cycleNodes.add(node);
			return true;
		}
		if (visited.has(node)) return false;

		visited.add(node);
		inStack.add(node);

		for (const neighbor of adj.get(node) || []) {
			if (dfs(neighbor)) {
				cycleNodes.add(node);
			}
		}

		inStack.delete(node);
		return false;
	}

	for (const node of adj.keys()) {
		if (!visited.has(node)) {
			dfs(node);
		}
	}

	return Array.from(cycleNodes);
}
