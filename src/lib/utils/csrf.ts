export function getCsrfToken(): string {
	if (typeof document === 'undefined') return '';
	const match = document.cookie.match(/(?:^|;\s*)gyre_csrf=([^;]+)/);
	const token = match ? decodeURIComponent(match[1]) : '';

	if (!token && import.meta.env?.DEV) {
		console.warn(
			'CSRF token (gyre_csrf cookie) is missing. State-changing requests will fail with 403 Forbidden.'
		);
	}

	return token;
}
