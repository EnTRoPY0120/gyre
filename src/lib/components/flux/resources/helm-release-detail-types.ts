export interface HelmReleaseChart {
	spec?: {
		chart?: string;
		version?: string;
		sourceRef?: { kind: string; name: string; namespace?: string };
	};
}

export interface HelmReleaseValuesFrom {
	kind: string;
	name: string;
}
