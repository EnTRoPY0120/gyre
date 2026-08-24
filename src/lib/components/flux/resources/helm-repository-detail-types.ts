export interface HelmRepositorySecretRef {
	name: string;
}

export interface HelmRepositoryArtifact {
	path?: string;
	url?: string;
	revision?: string;
	lastUpdateTime?: string;
}
