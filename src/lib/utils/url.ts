export const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'ssh:', 'git:', 'oci:'];

/**
 * Returns true if the given URL has a safe protocol for external linking.
 * Unsafe protocols (e.g. javascript:, data:) return false.
 */
export function isSafeExternalUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		return SAFE_URL_PROTOCOLS.includes(new URL(url).protocol);
	} catch {
		return false;
	}
}
