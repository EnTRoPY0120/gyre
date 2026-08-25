import { createHash, randomBytes } from 'node:crypto';
import {
	createConfigurationErrorResponse,
	createGenericErrorResponse,
	createHttpErrorResponse,
	createKubernetesErrorResponse,
	isHttpErrorLike
} from '../../lib/server/kubernetes/error-response.js';

export function createLoggerModuleStub() {
	return {
		logger: {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {}
		},
		withRequestContext: async <T>(requestId: string, fn: () => T | Promise<T>) => {
			void requestId;
			return await fn();
		}
	};
}

function computeAuthTag(ivHex: string, ciphertext: string) {
	return createHash('sha256')
		.update(ivHex)
		.update(':')
		.update(ciphertext)
		.digest('hex')
		.slice(0, 32);
}

export function createAuthCryptoModuleStub(
	overrides: Partial<{
		decryptSecret: (value: string) => string;
		encryptSecret: (value: string) => string;
		isUsingDevelopmentAuthKey: () => boolean;
		testAuthEncryption: () => boolean;
	}> = {}
) {
	const stub = {
		decryptSecret: (value: string) => {
			const parts = value.split(':');
			if (parts.length === 3) {
				const [ivHex, ciphertext, authTag] = parts;
				if (!/^[0-9a-f]{32}$/.test(ivHex) || !/^[0-9a-f]{32}$/.test(authTag)) {
					throw new Error('Invalid encrypted secret format');
				}

				if (computeAuthTag(ivHex, ciphertext) !== authTag) {
					throw new Error('Authentication failed');
				}

				return Buffer.from(ciphertext, 'base64').toString('utf8');
			}

			if (parts.length !== 1) {
				throw new Error('Invalid encrypted secret format');
			}

			if (value.includes('secret')) {
				return `decrypted_${value}`;
			}

			throw new Error('Invalid encrypted secret format');
		},
		encryptSecret: (value: string) => {
			const ivHex = randomBytes(16).toString('hex');
			const ciphertext = Buffer.from(value, 'utf8').toString('base64');
			const authTag = computeAuthTag(ivHex, ciphertext);
			return `${ivHex}:${ciphertext}:${authTag}`;
		},
		isUsingDevelopmentAuthKey: () => !process.env.AUTH_ENCRYPTION_KEY,
		testAuthEncryption: () => {
			const encrypted = stub.encryptSecret('test-value');
			return stub.decryptSecret(encrypted) === 'test-value';
		}
	};

	return { ...stub, ...overrides };
}

export function createRateLimiterModuleStub() {
	return {
		checkRateLimit: () => {},
		tryCheckRateLimit: () => ({ limited: false, retryAfter: 0 }),
		accountLockout: {
			check: () => ({ locked: false, retryAfter: 0 }),
			recordFailure: () => {},
			recordSuccess: () => {}
		},
		sseConnectionLimiter: {
			acquire: () => ({
				allowed: true as const,
				release: () => {}
			}),
			getConnectionCounts: () => ({ session: 0, user: 0 })
		}
	};
}

export function createRbacModuleStub(
	overrides: Partial<{
		checkPermission: (
			...args: [unknown, 'read' | 'write' | 'admin', string?, string?, string?]
		) => boolean | Promise<boolean>;
		checkClusterWideReadPermission: (...args: [unknown, string?]) => boolean | Promise<boolean>;
		requirePermission: (
			...args: [unknown, 'read' | 'write' | 'admin', string?, string?, string?]
		) => void | Promise<void>;
		isAdmin: (user: { role?: string } | null | undefined) => boolean;
		RbacError: typeof Error;
	}> = {}
) {
	class StubRbacError extends Error {
		body: { message: string; code: string };

		constructor(
			message: string,
			public action: 'read' | 'write' | 'admin',
			public resourceType?: string
		) {
			super(message);
			this.name = 'RbacError';
			this.body = {
				message,
				code: 'Forbidden'
			};
		}
	}

	const stub = {
		checkPermission: async () => true,
		checkClusterWideReadPermission: async () => true,
		requirePermission: async (
			user: unknown,
			action: 'read' | 'write' | 'admin',
			resourceType?: string,
			namespace?: string,
			clusterId?: string
		) => {
			const hasPermission = await stub.checkPermission(
				user,
				action,
				resourceType,
				namespace,
				clusterId
			);
			if (!hasPermission) {
				throw new StubRbacError(
					`Permission denied: ${action} on ${resourceType || 'resource'}`,
					action,
					resourceType
				);
			}
		},
		isAdmin: (user: { role?: string } | null | undefined) => user?.role === 'admin',
		RbacError: StubRbacError
	};

	return { ...stub, ...overrides };
}

export function createSettingsModuleStub(
	overrides: Partial<{
		SETTINGS_KEYS: {
			AUTH_LOCAL_LOGIN_ENABLED: string;
			AUTH_ALLOW_SIGNUP: string;
			AUTH_DOMAIN_ALLOWLIST: string;
			AUDIT_LOG_RETENTION_DAYS: string;
		};
		setSettings: (values: Array<{ key: string; value: string }>) => void | Promise<void>;
		getAuthSettings: () =>
			| {
					localLoginEnabled: boolean;
					allowSignup: boolean;
					domainAllowlist: string[];
			  }
			| Promise<{
					localLoginEnabled: boolean;
					allowSignup: boolean;
					domainAllowlist: string[];
			  }>;
		getAuditLogRetentionDays: () => number | Promise<number>;
		isSettingOverriddenByEnv: (key: string) => boolean;
		SETTING_ENV_OVERRIDES: Record<string, string>;
		seedAuthSettings: () => void | Promise<void>;
	}> = {}
) {
	const SETTINGS_KEYS = {
		AUTH_LOCAL_LOGIN_ENABLED: 'auth.localLoginEnabled',
		AUTH_ALLOW_SIGNUP: 'auth.allowSignup',
		AUTH_DOMAIN_ALLOWLIST: 'auth.domainAllowlist',
		AUDIT_LOG_RETENTION_DAYS: 'audit.retentionDays'
	};

	const stub = {
		SETTINGS_KEYS,
		setSettings: async () => {},
		getAuthSettings: async () => ({
			localLoginEnabled: true,
			allowSignup: true,
			domainAllowlist: []
		}),
		getAuditLogRetentionDays: async () => 90,
		isSettingOverriddenByEnv: () => false,
		SETTING_ENV_OVERRIDES: {
			[SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED]: 'GYRE_AUTH_LOCAL_LOGIN_ENABLED',
			[SETTINGS_KEYS.AUTH_ALLOW_SIGNUP]: 'GYRE_AUTH_ALLOW_SIGNUP',
			[SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST]: 'GYRE_AUTH_DOMAIN_ALLOWLIST',
			[SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS]: 'GYRE_AUDIT_LOG_RETENTION_DAYS'
		},
		seedAuthSettings: async () => {}
	};

	return { ...stub, ...overrides };
}

export function createKubernetesErrorsModuleStub(
	overrides: Partial<{
		KubernetesError: typeof Error;
		ResourceNotFoundError: typeof Error;
		AuthenticationError: typeof Error;
		AuthorizationError: typeof Error;
		ClusterUnavailableError: typeof Error;
		KubernetesTimeoutError: typeof Error;
		ConfigurationError: typeof Error;
		sanitizeK8sErrorMessage: (message: string) => string;
		handleApiError: (err: unknown, contextMessage?: string) => never;
		errorToHttpResponse: (error: unknown) => {
			status: number;
			body: { error: string; message?: string; code?: string };
		};
	}> = {}
) {
	class StubKubernetesError extends Error {
		constructor(
			message: string,
			public readonly code: number,
			public readonly reason?: string
		) {
			super(message);
			this.name = 'KubernetesError';
		}
	}

	class StubResourceNotFoundError extends StubKubernetesError {
		// fallow-ignore-next-line complexity
		constructor(resourceType: string, namespace?: string, name?: string) {
			const identifier =
				namespace && name ? `${namespace}/${name}` : namespace || name || 'resources';
			super(`${resourceType} not found: ${identifier}`, 404, 'NotFound');
			this.name = 'ResourceNotFoundError';
		}
	}

	class StubAuthenticationError extends StubKubernetesError {
		constructor(message = 'Failed to authenticate with Kubernetes API') {
			super(message, 401, 'Unauthorized');
			this.name = 'AuthenticationError';
		}
	}

	class StubAuthorizationError extends StubKubernetesError {
		constructor(message = 'Insufficient permissions to access resource') {
			super(message, 403, 'Forbidden');
			this.name = 'AuthorizationError';
		}
	}

	class StubClusterUnavailableError extends StubKubernetesError {
		constructor(message = 'Kubernetes cluster is currently unavailable') {
			super(message, 503, 'ServiceUnavailable');
			this.name = 'ClusterUnavailableError';
		}
	}

	class StubKubernetesTimeoutError extends StubKubernetesError {
		constructor(operation: string, timeoutMs: number) {
			super(
				`Kubernetes API request timed out after ${timeoutMs}ms: ${operation}`,
				504,
				'GatewayTimeout'
			);
			this.name = 'KubernetesTimeoutError';
		}
	}

	class StubConfigurationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ConfigurationError';
		}
	}

	const stub = {
		KubernetesError: StubKubernetesError,
		ResourceNotFoundError: StubResourceNotFoundError,
		AuthenticationError: StubAuthenticationError,
		AuthorizationError: StubAuthorizationError,
		ClusterUnavailableError: StubClusterUnavailableError,
		KubernetesTimeoutError: StubKubernetesTimeoutError,
		ConfigurationError: StubConfigurationError,
		sanitizeK8sErrorMessage: (message: string) => message || 'An unknown error occurred',
		handleApiError: (err: unknown) => {
			throw err;
		},
		errorToHttpResponse: (error: unknown) => {
			if (error instanceof StubConfigurationError) {
				return createConfigurationErrorResponse();
			}

			if (error instanceof StubKubernetesError) {
				return createKubernetesErrorResponse(error, (message) => message);
			}

			if (isHttpErrorLike(error)) {
				return createHttpErrorResponse(error);
			}

			return createGenericErrorResponse();
		}
	};

	return { ...stub, ...overrides };
}
