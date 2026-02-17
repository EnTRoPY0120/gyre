import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { listBackups } from '$lib/server/backup';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	try {
		const backups = listBackups();
		return { backups };
	} catch (err) {
		console.error('Failed to load backups:', err);
		throw error(500, { message: 'Failed to load backups' });
	}
};
