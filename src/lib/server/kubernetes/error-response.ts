export interface ErrorHttpResponse {
	status: number;
	body: { error: string; message?: string; code?: string };
}

interface KubernetesErrorLike {
	code: number;
	message: string;
	reason?: string;
}

interface HttpErrorLike {
	status: number;
	body: { message?: string; code?: string };
}

export function createKubernetesErrorResponse(
	error: KubernetesErrorLike,
	sanitizeMessage: (message: string) => string
): ErrorHttpResponse {
	return {
		status: error.code,
		body: {
			error: sanitizeMessage(error.message),
			code: error.reason
		}
	};
}

export function createConfigurationErrorResponse(): ErrorHttpResponse {
	return {
		status: 500,
		body: {
			error: 'Configuration error',
			code: 'ConfigurationError'
		}
	};
}

export function isHttpErrorLike(value: unknown): value is HttpErrorLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		'status' in value &&
		'body' in value &&
		typeof (value as { status: unknown }).status === 'number'
	);
}

export function createHttpErrorResponse(error: HttpErrorLike): ErrorHttpResponse {
	return {
		status: error.status,
		body: {
			error: error.body?.message ?? 'An unexpected error occurred',
			message: error.body?.message,
			code: error.body?.code
		}
	};
}

export function createGenericErrorResponse(): ErrorHttpResponse {
	return {
		status: 500,
		body: {
			error: 'An unexpected error occurred',
			code: 'InternalServerError'
		}
	};
}
