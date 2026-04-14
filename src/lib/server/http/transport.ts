export function setPrivateCacheHeaders(
	setHeaders: (headers: Record<string, string>) => void,
	cacheControl: string
): void {
	setHeaders({ 'Cache-Control': cacheControl });
}

export function computeWeakEtag(resourceVersion: string | null | undefined): string | null {
	return resourceVersion ? `W/"${resourceVersion}"` : null;
}

function normalizeEtagValue(value: string): string {
	const withoutWeakPrefix = value.trim().replace(/^W\/\s*/i, '');
	return withoutWeakPrefix.replace(/^"(.*)"$/, '$1');
}

export function respondNotModified(request: Request, etag: string | null): Response | null {
	const ifNoneMatch = request.headers.get('if-none-match');
	if (!etag || !ifNoneMatch) {
		return null;
	}

	if (ifNoneMatch.trim() === '*') {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}

	const normalizedEtag = normalizeEtagValue(etag);
	const matches = ifNoneMatch
		.split(',')
		.some((token) => normalizeEtagValue(token) === normalizedEtag);
	if (!matches) {
		return null;
	}

	return new Response(null, { status: 304, headers: { ETag: etag } });
}
