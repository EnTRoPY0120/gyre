export interface KustomizationSourceRef {
	kind: string;
	name: string;
	namespace?: string;
}

export interface KustomizationDependency {
	name: string;
	namespace?: string;
}

export interface KustomizationHealthCheck {
	kind: string;
	name: string;
	namespace: string;
}

export interface KustomizationPostBuild {
	substitute?: Record<string, string>;
	substituteFrom?: unknown[];
}
