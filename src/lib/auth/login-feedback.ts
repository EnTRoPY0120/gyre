export interface LoginQueryFeedback {
	loggedOut: boolean;
	errorMessage: string | null;
	shouldClear: boolean;
}

export function getLoginQueryFeedback(searchParams: URLSearchParams): LoginQueryFeedback {
	const loggedOut = searchParams.get('loggedOut') === 'true';
	const errorParam = searchParams.get('error');

	return {
		loggedOut,
		errorMessage: errorParam ? decodeURIComponent(errorParam) : null,
		shouldClear: loggedOut || errorParam !== null
	};
}
