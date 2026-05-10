export type ValidatedFluxArtifactUrl = {
	url: string;
	pathname: string;
};

export function getExpectedFluxArtifactHosts(fluxNamespace: string): Set<string> {
	const serviceName = process.env.FLUX_SOURCE_CONTROLLER_SERVICE || 'source-controller';
	return new Set([
		`${serviceName}.${fluxNamespace}.svc`,
		`${serviceName}.${fluxNamespace}.svc.cluster.local`
	]);
}

export function validateFluxArtifactUrl(
	artifactUrl: string,
	fluxNamespace: string
): ValidatedFluxArtifactUrl {
	let parsed: URL;
	try {
		parsed = new URL(artifactUrl);
	} catch {
		throw new Error('Artifact URL is not a valid URL');
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('Artifact URL must use http or https');
	}

	if (parsed.username || parsed.password) {
		throw new Error('Artifact URL must not contain user info');
	}

	const normalizedHost = parsed.hostname.endsWith('.')
		? parsed.hostname.slice(0, -1)
		: parsed.hostname;
	const allowedHosts = getExpectedFluxArtifactHosts(fluxNamespace);
	if (!allowedHosts.has(normalizedHost)) {
		throw new Error('Artifact URL host is not trusted');
	}

	parsed.hostname = normalizedHost;

	return {
		url: parsed.toString(),
		pathname: parsed.pathname
	};
}
