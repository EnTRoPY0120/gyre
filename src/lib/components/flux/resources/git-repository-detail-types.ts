export interface GitRepositoryRef {
	branch?: string;
	tag?: string;
	semver?: string;
	commit?: string;
}

export interface GitRepositorySecretRef {
	name: string;
}

export interface GitRepositoryArtifact {
	path?: string;
	url?: string;
	revision?: string;
	lastUpdateTime?: string;
}
