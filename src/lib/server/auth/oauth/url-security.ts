import type { OIDCDiscovery } from './types';
import { isIP } from 'node:net';

function stripIpv6Brackets(hostname: string): string {
	if (hostname.startsWith('[') && hostname.endsWith(']')) {
		return hostname.slice(1, -1);
	}

	return hostname;
}

function isUnsafeIpv4Address(address: string): boolean {
	const octets = address.split('.').map((part) => Number.parseInt(part, 10));
	if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
		return true;
	}

	const [a, b] = octets;

	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 192 && b === 0 && octets[2] === 2) return true;
	if (a === 198 && (b === 18 || b === 19)) return true;
	if (a === 198 && b === 51 && octets[2] === 100) return true;
	if (a === 203 && b === 0 && octets[2] === 113) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a >= 224) return true;

	return false;
}

function isUnsafeIpv6Address(address: string): boolean {
	const normalized = address.toLowerCase().split('%')[0];

	if (normalized === '::' || normalized === '::1') return true;
	if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
	if (/^fe[89ab]/.test(normalized)) return true;
	if (normalized.startsWith('ff')) return true;
	if (normalized.startsWith('2001:db8')) return true;

	if (normalized.startsWith('::ffff:')) {
		const mappedIpv4 = normalized.slice('::ffff:'.length);
		if (isIP(mappedIpv4) === 4) {
			return isUnsafeIpv4Address(mappedIpv4);
		}
	}

	return false;
}

function getUnsafeHostnameError(hostname: string): string | null {
	const normalized = stripIpv6Brackets(hostname).toLowerCase();
	if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
		return 'must not use localhost hosts';
	}

	const ipVersion = isIP(normalized);
	if (ipVersion === 4 && isUnsafeIpv4Address(normalized)) {
		return 'must not use private, loopback, or reserved IP addresses';
	}

	if (ipVersion === 6 && isUnsafeIpv6Address(normalized)) {
		return 'must not use private, loopback, or reserved IP addresses';
	}

	return null;
}

function validateRemoteHttpsUrl(urlString: string, fieldName: string, allowPath = true): URL {
	let url: URL;
	try {
		url = new URL(urlString);
	} catch {
		throw new Error(`${fieldName} must be a valid URL`);
	}

	if (url.protocol !== 'https:') {
		throw new Error(`${fieldName} must use HTTPS`);
	}

	if (url.username || url.password) {
		throw new Error(`${fieldName} must not include credentials`);
	}

	if (!allowPath && url.pathname !== '/' && url.pathname !== '') {
		throw new Error(`${fieldName} must not include a path`);
	}

	const hostError = getUnsafeHostnameError(url.hostname);
	if (hostError) {
		throw new Error(`${fieldName} ${hostError}`);
	}

	return url;
}

function normalizeIssuerForComparison(urlString: string): string {
	const url = new URL(urlString);
	const pathname = url.pathname.replace(/\/+$/, '');
	return `${url.origin}${pathname}`;
}

export function getIssuerUrlValidationError(issuerUrl: string): string | null {
	try {
		const url = validateRemoteHttpsUrl(issuerUrl.trim(), 'Issuer URL');
		if (url.search || url.hash) {
			return 'Issuer URL must not include query parameters or fragments';
		}
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : 'Issuer URL is invalid';
	}
}

export function assertSafeIssuerUrl(issuerUrl: string): URL {
	const trimmed = issuerUrl.trim();
	const validationError = getIssuerUrlValidationError(trimmed);
	if (validationError) {
		throw new Error(validationError);
	}

	return new URL(trimmed);
}

export function assertSafeOidcDiscoveryDocument(
	discovery: OIDCDiscovery,
	configuredIssuerUrl: string
): void {
	validateRemoteHttpsUrl(discovery.issuer, 'Discovery issuer');

	if (
		normalizeIssuerForComparison(discovery.issuer) !==
		normalizeIssuerForComparison(configuredIssuerUrl)
	) {
		throw new Error('Discovery issuer must match the configured issuer URL');
	}

	validateRemoteHttpsUrl(discovery.authorization_endpoint, 'OIDC authorization endpoint');
	validateRemoteHttpsUrl(discovery.token_endpoint, 'OIDC token endpoint');
	validateRemoteHttpsUrl(discovery.jwks_uri, 'OIDC JWKS URI');

	if (discovery.userinfo_endpoint) {
		validateRemoteHttpsUrl(discovery.userinfo_endpoint, 'OIDC userinfo endpoint');
	}
}
