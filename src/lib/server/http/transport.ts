export function setPrivateCacheHeaders(
	setHeaders: (headers: Record<string, string>) => void,
	cacheControl: string
): void {
	setHeaders({ 'Cache-Control': cacheControl });
}

export function computeWeakEtag(resourceVersion: string | null | undefined): string | null {
	return resourceVersion ? `W/"${resourceVersion}"` : null;
}

export function respondNotModified(request: Request, etag: string | null): Response | null {
	if (!etag || request.headers.get('if-none-match') !== etag) {
		return null;
	}

	return new Response(null, { status: 304 });
}
