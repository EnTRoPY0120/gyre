export function validatePasswordChangeInput(
	currentPassword: unknown,
	newPassword: unknown
): string | null {
	if (
		typeof currentPassword !== 'string' ||
		!currentPassword ||
		typeof newPassword !== 'string' ||
		!newPassword
	) {
		return 'Current password and new password are required';
	}

	return null;
}
