export function buildAdminSearchUrl(value: string): string {
	const url = new URL(window.location.href);
	if (value) {
		url.searchParams.set('search', value);
	} else {
		url.searchParams.delete('search');
	}
	url.searchParams.set('offset', '0');
	return url.toString();
}

export function buildAdminPageUrl(offset: number): string {
	const url = new URL(window.location.href);
	url.searchParams.set('offset', offset.toString());
	return url.toString();
}
