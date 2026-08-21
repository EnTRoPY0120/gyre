import { error } from '@sveltejs/kit';

export function assertPasswordStrength(password: string): void {
	const rules: Array<[RegExp, string]> = [
		[/[A-Z]/, 'New password must contain at least one uppercase letter.'],
		[/[a-z]/, 'New password must contain at least one lowercase letter.'],
		[/[0-9]/, 'New password must contain at least one number.'],
		[
			/[!@#$%^&*(),.?":{}|<>]/,
			'New password must contain at least one special character (e.g., !@#$%^&*).'
		]
	];
	if (password.length < 8) {
		throw error(400, { message: 'New password must be at least 8 characters long.' });
	}
	const failedRule = rules.find(([pattern]) => !pattern.test(password));
	if (failedRule) throw error(400, { message: failedRule[1] });
}
