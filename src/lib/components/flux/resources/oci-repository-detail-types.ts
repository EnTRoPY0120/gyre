export interface OCIRepositoryRef {
	tag?: string;
	semver?: string;
	semverFilter?: string;
	digest?: string;
}

export interface OCIRepositorySecretRef {
	name: string;
}

export interface OCILayerSelector {
	mediaType?: string;
	operation?: string;
}

export interface OCIRepositoryArtifact {
	path?: string;
	url?: string;
	revision?: string;
	lastUpdateTime?: string;
}
