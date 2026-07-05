/**
 * Utilities for analyzing and mapping FluxCD resource relationships.
 *
 * Relationship types in FluxCD:
 * - Source → Kustomization: Kustomization references a source (GitRepository, OCIRepository, Bucket)
 * - Source → HelmRelease: HelmRelease references a HelmRepository or GitRepository
 * - Alert → Provider: Alert sends to a provider
 * - Receiver → Resources: Receiver can trigger reconciliation on resources
 */

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

export interface ResourceNode {
	ref: ResourceRef;
	status?: 'ready' | 'pending' | 'failed' | 'suspended';
	children: ResourceNode[];
	parent?: ResourceNode;
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
