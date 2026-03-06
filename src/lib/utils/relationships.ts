/**
 * Utilities for analyzing and mapping FluxCD resource relationships.
 *
 * Relationship types in FluxCD:
 * - Source → Kustomization: Kustomization references a source (GitRepository, OCIRepository, Bucket)
 * - Source → HelmRelease: HelmRelease references a HelmRepository or GitRepository
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
		Receiver: FluxResourceType.Receiver
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
