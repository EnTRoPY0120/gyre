import { sanitizeK8sErrorMessage } from '../kubernetes/errors.js';

export function isAuthenticationRelatedError(message: string): boolean {
	return (
		message.includes('Unauthorized') ||
		message.includes('401') ||
		message.includes('Forbidden') ||
		message.includes('403') ||
		message.includes('certificate') ||
		message.includes('x509')
	);
}

export function describeReachabilityError(message: string): string {
	if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
		return 'DNS resolution failed. Check if the server address in kubeconfig is correct.';
	}
	if (message.includes('ECONNREFUSED') || message.includes('ECONNRESET')) {
		return 'Connection refused. Check if the Kubernetes API server is running and accessible.';
	}
	if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
		return 'Connection timed out. Check network connectivity and firewall rules.';
	}
	return message;
}

export function describeAuthenticationFailure(message: string): {
	name: 'Authentication' | 'Authorization';
	message: string;
	details: string;
} {
	const authenticationFailure =
		message.includes('Unauthorized') ||
		message.includes('401') ||
		message.includes('certificate') ||
		message.includes('x509');
	let details = message;

	if (message.includes('Unauthorized') || message.includes('401')) {
		details =
			'Authentication failed. Check if the token/certificate in kubeconfig is valid and not expired.';
	} else if (message.includes('Forbidden') || message.includes('403')) {
		details =
			'Authorization failed. The user/service account does not have permission to list namespaces. Gyre requires at least namespace listing permissions.';
	} else if (message.includes('certificate') || message.includes('x509')) {
		details = 'Certificate error. Check if the CA certificate is valid and matches the server.';
	}

	return {
		name: authenticationFailure ? 'Authentication' : 'Authorization',
		message: authenticationFailure ? 'Authentication failed' : 'Authorization failed',
		details: sanitizeK8sErrorMessage(details)
	};
}
