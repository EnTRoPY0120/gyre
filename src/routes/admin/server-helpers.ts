import { fail, type ActionFailure } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/rbac';
import type { User } from '$lib/server/db/schema';

export function requireAdminFormUser(locals: App.Locals): User | ActionFailure<{ error: string }> {
	if (!locals.user || !isAdmin(locals.user)) {
		return fail(403, { error: 'Forbidden' });
	}

	return locals.user;
}

export function getRequiredFormString(
	formData: FormData,
	key: string,
	message: string
): string | ActionFailure<{ error: string }> {
	const value = formData.get(key);

	if (typeof value !== 'string' || !value) {
		return fail(400, { error: message });
	}

	return value;
}

export function validateLength(
	value: string,
	options: {
		min?: number;
		max?: number;
		minMessage?: string;
		maxMessage?: string;
	}
): ActionFailure<{ error: string }> | null {
	if (options.min !== undefined && value.length < options.min) {
		return fail(400, { error: options.minMessage ?? `Must be at least ${options.min} characters` });
	}

	if (options.max !== undefined && value.length > options.max) {
		return fail(400, { error: options.maxMessage ?? `Must be at most ${options.max} characters` });
	}

	return null;
}

export function serializePagination<TInput, TOutput, TKey extends string>(
	page: { total: number } & Record<TKey, TInput[]> & Record<string, unknown>,
	itemsKey: TKey,
	mapper: (item: TInput) => TOutput
): { total: number } & Record<TKey, TOutput[]> & Record<string, unknown> {
	return {
		...page,
		[itemsKey]: page[itemsKey].map(mapper)
	} as { total: number } & Record<TKey, TOutput[]> & Record<string, unknown>;
}
