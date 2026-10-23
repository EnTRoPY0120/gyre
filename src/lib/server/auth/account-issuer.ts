// Preserve the issuer namespaces already stored in Gyre's accounts table.
// Better Auth 1.7.6 no longer exports these helpers or manages this metadata.
export function createLocalAccountIssuer(providerId: string): string {
	return `local:${encodeURIComponent(providerId)}`;
}

export function createOAuthAccountIssuer(providerId: string): string {
	return `local:oauth:${encodeURIComponent(providerId)}`;
}
