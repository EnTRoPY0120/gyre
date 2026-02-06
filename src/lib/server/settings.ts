/**
 * Application Settings Service
 * Manages key-value application settings with environment variable overrides.
 */

import { getDb } from './db';
import { appSettings, type NewAppSetting } from './db/schema';
import { eq } from 'drizzle-orm';

// Settings keys
export const SETTINGS_KEYS = {
	AUTH_LOCAL_LOGIN_ENABLED: 'auth.localLoginEnabled',
	AUTH_ALLOW_SIGNUP: 'auth.allowSignup',
	AUTH_DOMAIN_ALLOWLIST: 'auth.domainAllowlist'
} as const;

// Default values
const DEFAULTS: Record<string, string> = {
	[SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED]: 'true',
	[SETTINGS_KEYS.AUTH_ALLOW_SIGNUP]: 'true',
	[SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST]: '[]'
};

// Environment variable overrides (take precedence over DB)
const ENV_OVERRIDES: Record<string, string> = {
	[SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED]: 'GYRE_AUTH_LOCAL_LOGIN_ENABLED',
	[SETTINGS_KEYS.AUTH_ALLOW_SIGNUP]: 'GYRE_AUTH_ALLOW_SIGNUP',
	[SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST]: 'GYRE_AUTH_DOMAIN_ALLOWLIST'
};

// In-memory cache with TTL
interface CacheEntry {
	value: string;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get a setting value with env var override and caching support.
 * @param key - Setting key
 * @returns Setting value (env var > DB > default)
 */
export async function getSetting(key: string): Promise<string> {
	// Check env var override first
	const envVar = ENV_OVERRIDES[key];
	if (envVar && process.env[envVar]) {
		return process.env[envVar]!;
	}

	// Check cache
	const cached = cache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.value;
	}

	// Query database
	const db = await getDb();
	const setting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, key)
	});

	const value = setting?.value ?? DEFAULTS[key] ?? '';

	// Update cache
	cache.set(key, { value, timestamp: Date.now() });

	return value;
}

/**
 * Set a setting value in the database (upsert).
 * Note: Env var overrides will still take precedence at runtime.
 * @param key - Setting key
 * @param value - Setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
	const db = await getDb();

	// Upsert setting
	const existing = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, key)
	});

	if (existing) {
		await db
			.update(appSettings)
			.set({ value, updatedAt: new Date() })
			.where(eq(appSettings.key, key));
	} else {
		const newSetting: NewAppSetting = {
			key,
			value,
			updatedAt: new Date()
		};
		await db.insert(appSettings).values(newSetting);
	}

	// Invalidate cache
	cache.delete(key);
}

/**
 * Auth Settings interface
 */
export interface AuthSettings {
	localLoginEnabled: boolean;
	allowSignup: boolean;
	domainAllowlist: string[];
}

/**
 * Get all auth-related settings as a typed object.
 * @returns Auth settings object
 */
export async function getAuthSettings(): Promise<AuthSettings> {
	const localLoginEnabledStr = await getSetting(SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED);
	const allowSignupStr = await getSetting(SETTINGS_KEYS.AUTH_ALLOW_SIGNUP);
	const domainAllowlistStr = await getSetting(SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST);

	let domainAllowlist: string[] = [];
	try {
		domainAllowlist = JSON.parse(domainAllowlistStr);
		if (!Array.isArray(domainAllowlist)) {
			domainAllowlist = [];
		}
	} catch {
		domainAllowlist = [];
	}

	return {
		localLoginEnabled: localLoginEnabledStr === 'true',
		allowSignup: allowSignupStr === 'true',
		domainAllowlist
	};
}

/**
 * Convenience: Check if local login is enabled.
 */
export async function isLocalLoginEnabled(): Promise<boolean> {
	const settings = await getAuthSettings();
	return settings.localLoginEnabled;
}

/**
 * Convenience: Check if signup is allowed.
 */
export async function isSignupAllowed(): Promise<boolean> {
	const settings = await getAuthSettings();
	return settings.allowSignup;
}

/**
 * Convenience: Get domain allowlist.
 */
export async function getDomainAllowlist(): Promise<string[]> {
	const settings = await getAuthSettings();
	return settings.domainAllowlist;
}

/**
 * Check if a setting is overridden by an environment variable.
 * @param key - Setting key
 * @returns True if env var override is active
 */
export function isSettingOverriddenByEnv(key: string): boolean {
	const envVar = ENV_OVERRIDES[key];
	return !!(envVar && process.env[envVar]);
}

/**
 * Seed auth settings from environment variables on startup.
 * Only sets values if they don't already exist in DB.
 */
export async function seedAuthSettings(): Promise<void> {
	const db = await getDb();

	for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
		// Check if setting already exists
		const existing = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, key)
		});

		if (!existing) {
			// Use env var value if set, otherwise default
			const envVar = ENV_OVERRIDES[key];
			const value = (envVar && process.env[envVar]) || defaultValue;

			const newSetting: NewAppSetting = {
				key,
				value,
				updatedAt: new Date()
			};
			await db.insert(appSettings).values(newSetting);
		}
	}
}
