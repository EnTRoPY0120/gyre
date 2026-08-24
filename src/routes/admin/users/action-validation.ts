import { passwordSchema } from '$lib/utils/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
	role: string | null,
	active: string | null
): string | null {
	const emailError = validateEmail(email);
	if (emailError) return emailError;
	if (userId === adminUserId && role && role !== 'admin') {
		return 'Cannot remove your own admin role';
	}
	if (userId === adminUserId && active === 'false') {
		return 'Cannot deactivate your own account';
	}
	return null;
}

export function validatePasswordResetInput(userId: string, newPassword: string): string | null {
	if (!userId || !newPassword) return 'User ID and new password are required';
	return validatePassword(newPassword);
}
