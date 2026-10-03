import { passwordSchema } from '$lib/utils/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserUpdateInput {
	email: string;
	role: UserRole | null;
	active: boolean | null;
}

export type UserUpdateInputParseResult =
	| { success: true; data: UserUpdateInput }
	| { success: false; error: string };

const USER_ROLES = new Set<UserRole>(['admin', 'editor', 'viewer']);

/** Parse the admin edit form while preserving its checkbox/hidden-input convention. */
export function parseUserUpdateInput(formData: FormData): UserUpdateInputParseResult {
	const emailValues = formData.getAll('email');
	if (emailValues.some((value) => typeof value !== 'string') || emailValues.length > 1) {
		return { success: false, error: 'Invalid email value' };
	}
	const email = typeof emailValues[0] === 'string' ? emailValues[0] : '';

	const roleValues = formData.getAll('role');
	if (roleValues.some((value) => typeof value !== 'string') || roleValues.length > 1) {
		return { success: false, error: 'Invalid role' };
	}
	const rawRole = roleValues[0] ?? '';
	if (rawRole !== '' && !USER_ROLES.has(rawRole as UserRole)) {
		return { success: false, error: 'Invalid role' };
	}
	const role = rawRole === '' ? null : (rawRole as UserRole);

	const activeValues = formData.getAll('active');
	if (activeValues.some((value) => typeof value !== 'string')) {
		return { success: false, error: 'Invalid active value' };
	}
	const rawActiveValues = activeValues as string[];
	const isCheckboxPair =
		rawActiveValues.length === 2 && rawActiveValues[0] === 'true' && rawActiveValues[1] === 'false';
	if (
		(rawActiveValues.length > 1 && !isCheckboxPair) ||
		rawActiveValues.some((value) => value !== 'true' && value !== 'false')
	) {
		return { success: false, error: 'Invalid active value' };
	}
	const active = rawActiveValues.length === 0 ? null : rawActiveValues[0] === 'true';

	return { success: true, data: { email, role, active } };
}

function validateEmail(email: string): string | null {
	return email && !EMAIL_PATTERN.test(email) ? 'Invalid email format' : null;
}

function validatePassword(password: string): string | null {
	const result = passwordSchema.safeParse(password);
	return result.success
		? null
		: (result.error.issues[0]?.message ?? 'Password does not meet strength requirements');
}

export function validateUserCreateInput(
	username: string,
	email: string,
	password: string,
	role: string
): string | null {
	if (!username || !password || !role) {
		return 'Username, password, and role are required';
	}
	if (username.length < 3) return 'Username must be at least 3 characters';
	if (username.length > 64) return 'Username must be at most 64 characters';
	return validateEmail(email) ?? validatePassword(password);
}

export function validateUserUpdateInput(
	userId: string,
	adminUserId: string,
	email: string,
	role: UserRole | null,
	active: boolean | null
): string | null {
	const emailError = validateEmail(email);
	if (emailError) return emailError;
	if (userId === adminUserId && role && role !== 'admin') {
		return 'Cannot remove your own admin role';
	}
	if (userId === adminUserId && active === false) {
		return 'Cannot deactivate your own account';
	}
	return null;
}

export function validatePasswordResetInput(userId: string, newPassword: string): string | null {
	if (!userId || !newPassword) return 'User ID and new password are required';
	return validatePassword(newPassword);
}
