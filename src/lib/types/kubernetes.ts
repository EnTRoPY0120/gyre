/**
 * Generic Kubernetes resource structure
 */
export interface K8sResource {
	apiVersion: string;
	kind: string;
	metadata: {
		name: string;
		namespace?: string;
		uid?: string;
		resourceVersion?: string;
		generation?: number;
		creationTimestamp?: string;
		deletionTimestamp?: string;
		labels?: Record<string, string>;
		annotations?: Record<string, string>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}
