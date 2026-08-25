import { loginSchema } from '$lib/utils/validation';

export interface LoginProvider {
	id: string;
	name: string;
	type: string;
}

export interface LoginResponse {
	user?: {
		requiresPasswordChange?: boolean;
		canChangePassword?: boolean;
	};
}

export class LoginRequestError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'LoginRequestError';
	}
}

export function getLoginErrorState(error: unknown): {
	password?: string;
	message: string;
} {
	const password =
		error instanceof LoginRequestError && error.status === 401 ? error.message : undefined;
	return {
		...(password ? { password } : {}),
		message: error instanceof Error ? error.message : 'Login failed'
	};
}

export function validateLoginCredentials(username: string, password: string) {
	const validation = loginSchema.safeParse({ username, password });
	if (validation.success) return { errors: {}, firstMessage: null };

	const errors: Record<string, string> = {};
	for (const issue of validation.error.issues) {
		const field = issue.path[0];
		if (typeof field === 'string') errors[field] = issue.message;
	}

	return {
		errors,
		firstMessage: validation.error.issues[0]?.message ?? 'Invalid credentials'
	};
}

export async function submitLogin(username: string, password: string): Promise<LoginResponse> {
	const response = await fetch('/api/v1/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});

	const result = (await response.json()) as LoginResponse & {
		message?: string | { message?: string };
	};
	if (!response.ok) {
		const message = typeof result.message === 'object' ? result.message.message : result.message;
		throw new LoginRequestError(message || 'Login failed', response.status);
	}

	return result;
}

export function getLoginDestination(returnTo: string | null, currentUrl: string): string {
	if (!returnTo) return '/';

	try {
		const parsed = new URL(returnTo, currentUrl);
		if (
			parsed.origin === new URL(currentUrl).origin &&
			(parsed.protocol === 'http:' || parsed.protocol === 'https:')
		) {
			return parsed.pathname + parsed.search + parsed.hash;
		}
	} catch {
		// Malformed or cross-origin return targets fall back to the home page.
	}

	return '/';
}

export function getPostLoginRedirect(
	result: LoginResponse,
	returnTo: string | null,
	currentUrl: string
): string {
	if (result.user?.requiresPasswordChange && result.user?.canChangePassword) {
		return '/change-password?first=true';
	}

	return getLoginDestination(returnTo, currentUrl);
}

export function getProviderIcon(type: string): string {
	return (
		(
			{
				'oauth2-google': 'google',
				'oauth2-github': 'github',
				'oauth2-gitlab': 'gitlab',
				oidc: 'shield'
			} satisfies Record<string, string>
		)[type] ?? 'key'
	);
}

export function getProviderColor(type: string): string {
	return (
		(
			{
				'oauth2-google': 'provider-google',
				'oauth2-github': 'provider-github',
				'oauth2-gitlab': 'provider-gitlab'
			} satisfies Record<string, string>
		)[type] ?? 'provider-oidc'
	);
}
