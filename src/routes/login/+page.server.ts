import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getEnabledAuthProviders } from '$lib/server/auth/oauth';
import { getAuthSettings } from '$lib/server/settings';

/**
 * Load function for login page
 * If user is already authenticated, redirect to home
 * Otherwise, load SSO providers for display
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}

	// Fetch enabled SSO providers
	let providers: Array<{ id: string; name: string; type: string }> = [];
	try {
		const enabledProviders = await getEnabledAuthProviders();
		providers = enabledProviders.map((p) => ({
			id: p.id,
			name: p.name,
			type: p.type
		}));
	} catch (error) {
		console.error('Failed to load auth providers:', error);
		// Continue without SSO providers - local login should still work
	}

	// Get auth settings
	const authSettings = await getAuthSettings();

	return {
		mode: locals.cluster ? 'in-cluster' : 'local',
		providers,
		localLoginEnabled: authSettings.localLoginEnabled
	};
};
