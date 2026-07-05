import { logger } from '$lib/server/logger.js';
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { serializePublicSettings } from '$lib/server/settings/serialization';

/**
 * Load settings for admin page
 */
export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Check admin role
	if (locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		return serializePublicSettings();
	} catch (err) {
		logger.error(err, 'Failed to load settings:');
		throw error(500, { message: 'Failed to load settings' });
	}
};
