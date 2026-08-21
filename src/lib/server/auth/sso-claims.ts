import type { AuthProvider } from '$lib/server/db/schema';
import type { OAuthUserInfo } from './oauth/types';

export function extractUsername(userInfo: OAuthUserInfo, config: AuthProvider): string {
	const username = extractClaim(userInfo, config.usernameClaim);
	if (username) return sanitizeUsername(username);
	if (userInfo.username) return sanitizeUsername(userInfo.username);
	if (userInfo.email) return sanitizeUsername(userInfo.email.split('@')[0]);
	return sanitizeUsername(userInfo.sub);
}

export function extractEmail(userInfo: OAuthUserInfo, config: AuthProvider): string | undefined {
	const email = canonicalizeEmail(extractClaim(userInfo, config.emailClaim));
	if (email && isValidEmail(email)) return email;

	const fallbackEmail = canonicalizeEmail(userInfo.email);
	return fallbackEmail && isValidEmail(fallbackEmail) ? fallbackEmail : undefined;
}

export function canonicalizeEmail(email: string | null | undefined): string | undefined {
	const canonicalEmail = email?.trim().toLowerCase();
	return canonicalEmail || undefined;
}

function extractClaim(userInfo: Record<string, unknown>, claimPath: string): string | undefined {
	const parts = claimPath.split('.');
	let value: unknown = userInfo;

	for (const part of parts) {
		if (value && typeof value === 'object' && part in value) {
			value = (value as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}

	return typeof value === 'string' ? value : undefined;
}

function sanitizeUsername(username: string): string {
	return username
		.toLowerCase()
		.replace(/[^a-z0-9_.-]/g, '_')
		.replace(/_{2,}/g, '_')
		.replace(/^[_.-]+|[_.-]+$/g, '')
		.substring(0, 50);
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
